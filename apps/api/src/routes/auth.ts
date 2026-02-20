import { Hono } from 'hono'
import { OAuth2Client } from 'google-auth-library'
import * as jose from 'jose'
import { randomUUID } from 'node:crypto'
import { createUserRepository, createAuthSessionRepository } from '@bidradar/db'
import type { Env } from '../env.js'

const SESSION_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Simple in-memory rate limiter for session creation.
// Effective for local dev and warm Lambda instances.
const SESSION_RATE_LIMIT = 20
const SESSION_RATE_WINDOW_MS = 60_000
const sessionTimestamps: number[] = []

function isSessionRateLimited(): boolean {
  const now = Date.now()
  while (sessionTimestamps.length > 0 && sessionTimestamps[0]! < now - SESSION_RATE_WINDOW_MS) {
    sessionTimestamps.shift()
  }
  if (sessionTimestamps.length >= SESSION_RATE_LIMIT) {
    return true
  }
  sessionTimestamps.push(now)
  return false
}

export function authRoutes(env: Env) {
  const app = new Hono()
  const oauthClient = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  )
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  const sessionRepo = createAuthSessionRepository()

  // POST /auth/session — CLI requests a login session
  app.post('/session', async (c) => {
    if (isSessionRateLimited()) {
      return c.json(
        { error: 'RATE_LIMITED', message: 'Too many session requests. Try again later.', statusCode: 429 },
        429,
      )
    }
    await sessionRepo.cleanExpired()
    const sessionId = randomUUID()
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await sessionRepo.create(sessionId, expiresAt)
    return c.json({ sessionId })
  })

  // GET /auth/login — browser is directed here, redirects to Google
  app.get('/login', async (c) => {
    const sessionId = c.req.query('session')
    if (!sessionId) {
      return c.text('Invalid or expired session', 400)
    }

    const session = await sessionRepo.find(sessionId)
    if (!session) {
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
        const session = await sessionRepo.find(state)
        if (session) await sessionRepo.setError(state, error)
      }
      return c.html(
        '<html><body><h1>Authentication failed</h1><p>You can close this tab.</p></body></html>',
      )
    }

    if (!code || !state) {
      return c.text('Missing code or state', 400)
    }

    const session = await sessionRepo.find(state)
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
        await sessionRepo.setError(state, 'Failed to obtain ID token from Google')
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
        await sessionRepo.setError(state, 'Invalid Google token payload')
        return c.html(
          '<html><body><h1>Authentication failed</h1><p>You can close this tab.</p></body></html>',
        )
      }

      const userRepo = createUserRepository()
      let user = await userRepo.findByGoogleId(googlePayload.sub)

      if (!user) {
        const role = env.ADMIN_EMAILS.includes(googlePayload.email)
          ? ('admin' as const)
          : ('free' as const)

        user = await userRepo.createUser({
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
        .setIssuer('bidradar')
        .setExpirationTime('7d')
        .sign(secret)

      await sessionRepo.setResult(state, {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      })

      return c.html(
        '<html><body><h1>Authentication successful!</h1><p>You can close this tab and return to the terminal.</p></body></html>',
      )
    } catch (err) {
      await sessionRepo.setError(
        state,
        err instanceof Error ? err.message : 'Authentication failed',
      )
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

    const session = await sessionRepo.find(sessionId)
    if (!session) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Invalid or expired session', statusCode: 404 },
        404,
      )
    }

    if (session.error) {
      await sessionRepo.delete(sessionId)
      return c.json(
        { error: 'UNAUTHORIZED', message: session.error, statusCode: 401 },
        401,
      )
    }

    if (session.result) {
      await sessionRepo.delete(sessionId)
      return c.json(session.result)
    }

    // Still pending — CLI should keep polling
    return c.json({ status: 'pending' as const })
  })

  return app
}
