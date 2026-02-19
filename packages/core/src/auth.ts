import { z } from 'zod'

export const Role = {
  ADMIN: 'admin',
  FREE: 'free',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const RoleSchema = z.enum(['admin', 'free'])

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
}

export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
})
