import type { ApiKeyRepository } from '@bidradar/core'
import { eq, isNull, and } from 'drizzle-orm'
import { getDb } from './connection.js'
import { apiKeys, users } from './schema.js'

export function createApiKeyRepository(): ApiKeyRepository {
  const db = getDb()

  return {
    async insert(params) {
      const [row] = await db
        .insert(apiKeys)
        .values({
          name: params.name,
          keyPrefix: params.keyPrefix,
          keyHash: params.keyHash,
          userId: params.userId,
        })
        .returning({ id: apiKeys.id })
      return row!.id
    },

    async findByKeyHash(keyHash) {
      const [row] = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          keyHash: apiKeys.keyHash,
          userId: apiKeys.userId,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
          userEmail: users.email,
          userName: users.name,
          userRole: users.role,
        })
        .from(apiKeys)
        .innerJoin(users, eq(apiKeys.userId, users.id))
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1)
      return row
    },

    async updateLastUsed(id) {
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, id))
    },

    async revoke(id) {
      await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(apiKeys.id, id))
    },

    async revokeByName(userId, name) {
      const rows = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.name, name),
            isNull(apiKeys.revokedAt),
          ),
        )
        .returning({ id: apiKeys.id })
      return rows.length > 0
    },

    async listByUserId(userId) {
      return db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          keyHash: apiKeys.keyHash,
          userId: apiKeys.userId,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
    },
  }
}
