import { createHash } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import * as jose from 'jose'
import { AuthUserSchema, type AuthUser } from '@bidradar/core'
import { createApiKeyRepository } from '@bidradar/db'

export type AuthEnv = {
  Variables: {
    user: AuthUser
  }
}

export function authenticate(jwtSecret: string) {
  const secret = new TextEncoder().encode(jwtSecret)

  return createMiddleware<AuthEnv>(async (c, next) => {
    // 1. Try JWT (Authorization: Bearer <token>)
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const { payload } = await jose.jwtVerify(token, secret, {
          algorithms: ['HS256'],
          issuer: 'bidradar',
        })

        const parsed = AuthUserSchema.safeParse({
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
        })

        if (!parsed.success) {
          return c.json(
            {
              error: 'UNAUTHORIZED',
              message: 'Invalid token payload',
              statusCode: 401,
            },
            401,
          )
        }

        c.set('user', parsed.data)

        return await next()
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
    }

    // 2. Try API key (X-API-Key: <key>)
    const apiKeyHeader = c.req.header('X-API-Key')
    if (apiKeyHeader) {
      const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex')
      const apiKeyRepo = createApiKeyRepository()
      const record = await apiKeyRepo.findByKeyHash(keyHash)

      if (!record || record.revokedAt) {
        return c.json(
          {
            error: 'UNAUTHORIZED',
            message: 'Invalid or revoked API key',
            statusCode: 401,
          },
          401,
        )
      }

      c.set('user', {
        id: record.userId,
        email: record.userEmail,
        name: record.userName,
        role: record.userRole as AuthUser['role'],
      })

      // Fire-and-forget: update last_used_at
      apiKeyRepo.updateLastUsed(record.id).catch(() => {})

      return await next()
    }

    return c.json(
      {
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
        statusCode: 401,
      },
      401,
    )
  })
}
