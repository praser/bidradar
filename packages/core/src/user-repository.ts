import type { User } from './user.js'

export interface UserRepository {
  findByGoogleId(googleId: string): Promise<User | undefined>
  findByEmail(email: string): Promise<User | undefined>
  findById(id: string): Promise<User | undefined>
  createUser(data: {
    email: string
    name: string
    googleId: string
    role: 'admin' | 'free'
  }): Promise<User>
}
