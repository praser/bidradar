import { eq } from 'drizzle-orm'
import type { User, UserRepository } from '@bidradar/core'
import { getDb } from './connection.js'
import { users, type UserRow } from './schema.js'

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    googleId: row.googleId,
    role: row.role as User['role'],
  }
}

export function createUserRepository(): UserRepository {
  const db = getDb()

  return {
    async findByGoogleId(googleId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.googleId, googleId))
        .limit(1)
      return user !== undefined ? rowToUser(user) : undefined
    },

    async findByEmail(email) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
      return user !== undefined ? rowToUser(user) : undefined
    },

    async findById(id) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
      return user !== undefined ? rowToUser(user) : undefined
    },

    async createUser(data) {
      const [user] = await db.insert(users).values(data).returning()
      if (!user) throw new Error('Failed to create user')
      return rowToUser(user)
    },
  }
}
