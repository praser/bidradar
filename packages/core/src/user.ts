import type { Role } from './auth.js'

export interface User {
  id: string
  email: string
  name: string
  googleId: string
  role: Role
}
