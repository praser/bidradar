import { createMiddleware } from 'hono/factory'
import * as jose from 'jose'
import type { AuthUser } from '@bidradar/core'

export type AuthEnv = {
  Variables: {
    user: AuthUser
  }
}

export function authenticate(jwtSecret: string) {
  const secret = new TextEncoder().encode(jwtSecret)

  return createMiddleware<AuthEnv>(async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header',
          statusCode: 401,
        },
        401,
      )
    }

    const token = authHeader.slice(7)

    try {
      const { payload } = await jose.jwtVerify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'bidradar',
      })

      c.set('user', {
        id: payload.sub as string,
        email: payload.email as string,
        name: payload.name as string,
        role: payload.role as AuthUser['role'],
      })

      await next()
    } catch {
      return c.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
          statusCode: 401,
        },
        401,
      )
    }
  })
}
