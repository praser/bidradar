import { eq, lt } from 'drizzle-orm'
import { getDb } from './connection.js'
import { authSessions } from './schema.js'

interface SessionResult {
  token: string
  user: { id: string; email: string; name: string; role: string }
}

export interface AuthSession {
  id: string
  result: SessionResult | null
  error: string | null
  createdAt: Date
  expiresAt: Date
}

export function createAuthSessionRepository() {
  const db = getDb()

  return {
    async create(id: string, expiresAt: Date): Promise<void> {
      await db.insert(authSessions).values({ id, expiresAt })
    },

    async find(id: string): Promise<AuthSession | null> {
      const [row] = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, id))
        .limit(1)
      if (!row || row.expiresAt < new Date()) return null
      return {
        id: row.id,
        result: row.result as SessionResult | null,
        error: row.error,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      }
    },

    async setResult(id: string, result: SessionResult): Promise<void> {
      await db
        .update(authSessions)
        .set({ result })
        .where(eq(authSessions.id, id))
    },

    async setError(id: string, error: string): Promise<void> {
      await db
        .update(authSessions)
        .set({ error })
        .where(eq(authSessions.id, id))
    },

    async delete(id: string): Promise<void> {
      await db.delete(authSessions).where(eq(authSessions.id, id))
    },

    async cleanExpired(): Promise<void> {
      await db
        .delete(authSessions)
        .where(lt(authSessions.expiresAt, new Date()))
    },
  }
}
