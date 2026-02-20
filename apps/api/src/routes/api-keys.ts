import { randomBytes, createHash } from 'node:crypto'
import { Hono } from 'hono'
import { CreateApiKeyRequestSchema } from '@bidradar/api-contract'
import { createApiKeyRepository } from '@bidradar/db'
import type { AuthEnv } from '../middleware/authenticate.js'

export function apiKeyRoutes() {
  const app = new Hono<AuthEnv>()

  app.post('/', async (c) => {
    const body = await c.req.json()
    const parsed = CreateApiKeyRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.message,
          statusCode: 400,
        },
        400,
      )
    }

    const repo = createApiKeyRepository()
    const user = c.get('user')

    const existing = await repo.listByUserId(user.id)
    if (existing.some((k) => k.name === parsed.data.name)) {
      return c.json(
        {
          error: 'CONFLICT',
          message: `API key with name '${parsed.data.name}' already exists`,
          statusCode: 409,
        },
        409,
      )
    }

    const rawKey = `br_${randomBytes(32).toString('hex')}`
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.slice(0, 11)

    const id = await repo.insert({
      name: parsed.data.name,
      keyPrefix,
      keyHash,
      userId: user.id,
    })

    return c.json(
      {
        id,
        name: parsed.data.name,
        key: rawKey,
        keyPrefix,
        createdAt: new Date().toISOString(),
      },
      201,
    )
  })

  app.get('/', async (c) => {
    const user = c.get('user')
    const repo = createApiKeyRepository()
    const keys = await repo.listByUserId(user.id)

    return c.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
      })),
    })
  })

  app.delete('/:name', async (c) => {
    const user = c.get('user')
    const keyName = c.req.param('name')
    const repo = createApiKeyRepository()

    const revoked = await repo.revokeByName(user.id, keyName)
    if (!revoked) {
      return c.json(
        {
          error: 'NOT_FOUND',
          message: 'API key not found or already revoked',
          statusCode: 404,
        },
        404,
      )
    }

    return c.json({ revoked: true })
  })

  return app
}
