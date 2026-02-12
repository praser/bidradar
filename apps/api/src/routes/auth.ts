import { Hono } from 'hono'
import { OAuth2Client } from 'google-auth-library'
import * as jose from 'jose'
import { randomUUID } from 'node:crypto'
import { createUserRepository } from '@bidradar/db'
import type { Env } from '../env.js'

interface PendingSession {
  createdAt: number
  result?: {
    token: string
    user: { id: string; email: string; name: string; role: string }
  }
  error?: string
}

const SESSION_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function authRoutes(env: Env) {
  const app = new Hono()
  const oauthClient = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  )
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  const sessions = new Map<string, PendingSession>()

  function cleanExpiredSessions() {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(id)
      }
    }
  }

  // POST /auth/session — CLI requests a login session
  app.post('/session', async (c) => {
    cleanExpiredSessions()
    const sessionId = randomUUID()
    sessions.set(sessionId, { createdAt: Date.now() })
    return c.json({ sessionId })
  })

  // GET /auth/login — browser is directed here, redirects to Google
  app.get('/login', async (c) => {
    const sessionId = c.req.query('session')
    if (!sessionId || !sessions.has(sessionId)) {
      return c.text('Invalid or expired session', 400)
    }

    const callbackUrl = new URL('/auth/callback', c.req.url)
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', callbackUrl.origin + callbackUrl.pathname)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'openid email profile')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('state', sessionId)

    return c.redirect(authUrl.toString())
  })

  // GET /auth/callback — Google redirects here after consent
  app.get('/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error) {
      if (state) {
        const session = sessions.get(state)
        if (session) session.error = error
      }
      return c.html(
        '<html><body><h1>Authentication failed</h1><p>You can close this tab.</p></body></html>',
      )
    }

    if (!code || !state) {
      return c.text('Missing code or state', 400)
    }

    const session = sessions.get(state)
    if (!session) {
      return c.text('Invalid or expired session', 400)
    }

    try {
      const callbackUrl = new URL('/auth/callback', c.req.url)
      const redirectUri = callbackUrl.origin + callbackUrl.pathname

      const { tokens } = await oauthClient.getToken({
        code,
        redirect_uri: redirectUri,
      })

      const idToken = tokens.id_token
      if (!idToken) {
        session.error = 'Failed to obtain ID token from Google'
        return c.html(
          '<html><body><h1>Authentication failed</h1><p>You can close this tab.</p></body></html>',
        )
      }

      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      })

      const googlePayload = ticket.getPayload()
      if (!googlePayload?.sub || !googlePayload.email) {
        session.error = 'Invalid Google token payload'
        return c.html(
          '<html><body><h1>Authentication failed</h1><p>You can close this tab.</p></body></html>',
        )
      }

      const repo = createUserRepository()
      let user = await repo.findByGoogleId(googlePayload.sub)

      if (!user) {
        const role = env.ADMIN_EMAILS.includes(googlePayload.email)
          ? ('admin' as const)
          : ('free' as const)

        user = await repo.createUser({
          email: googlePayload.email,
          name: googlePayload.name ?? googlePayload.email,
          googleId: googlePayload.sub,
          role,
        })
      }

      const token = await new jose.SignJWT({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret)

      session.result = {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      }

      return c.html(
        '<html><body><h1>Authentication successful!</h1><p>You can close this tab and return to the terminal.</p></body></html>',
      )
    } catch (err) {
      session.error =
        err instanceof Error ? err.message : 'Authentication failed'
      return c.html(
        '<html><body><h1>Authentication failed</h1><p>You can close this tab.</p></body></html>',
      )
    }
  })

  // GET /auth/token — CLI polls this to get the JWT
  app.get('/token', async (c) => {
    const sessionId = c.req.query('session')
    if (!sessionId) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: 'Missing session parameter', statusCode: 400 },
        400,
      )
    }

    const session = sessions.get(sessionId)
    if (!session) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Invalid or expired session', statusCode: 404 },
        404,
      )
    }

    if (session.error) {
      sessions.delete(sessionId)
      return c.json(
        { error: 'UNAUTHORIZED', message: session.error, statusCode: 401 },
        401,
      )
    }

    if (session.result) {
      sessions.delete(sessionId)
      return c.json(session.result)
    }

    // Still pending — CLI should keep polling
    return c.json({ status: 'pending' as const })
  })

  return app
}
