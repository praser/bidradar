import { eq } from 'drizzle-orm'
import { getDb } from './index.js'
import { users, type UserRow } from './schema.js'

export interface UserRepository {
  findByGoogleId(googleId: string): Promise<UserRow | undefined>
  findByEmail(email: string): Promise<UserRow | undefined>
  findById(id: string): Promise<UserRow | undefined>
  createUser(data: {
    email: string
    name: string
    googleId: string
    role: 'admin' | 'free'
  }): Promise<UserRow>
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
      return user
    },

    async findByEmail(email) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
      return user
    },

    async findById(id) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
      return user
    },

    async createUser(data) {
      const [user] = await db.insert(users).values(data).returning()
      if (!user) throw new Error('Failed to create user')
      return user
    },
  }
}
