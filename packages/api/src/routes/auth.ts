import { Hono } from 'hono'
import { OAuth2Client } from 'google-auth-library'
import * as jose from 'jose'
import { GoogleAuthRequestSchema } from '@bidradar/shared'
import { createUserRepository } from '../db/userRepository.js'
import type { Env } from '../env.js'

export function authRoutes(env: Env) {
  const app = new Hono()
  const oauthClient = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  )
  const secret = new TextEncoder().encode(env.JWT_SECRET)

  // POST /auth/google
  app.post('/google', async (c) => {
    const body = GoogleAuthRequestSchema.parse(await c.req.json())

    const { tokens } = await oauthClient.getToken({
      code: body.code,
      redirect_uri: body.redirectUri,
    })

    const idToken = tokens.id_token
    if (!idToken) {
      return c.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Failed to obtain ID token from Google',
          statusCode: 401,
        },
        401,
      )
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    })

    const googlePayload = ticket.getPayload()
    if (!googlePayload?.sub || !googlePayload.email) {
      return c.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid Google token',
          statusCode: 401,
        },
        401,
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

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  })

  return app
}
