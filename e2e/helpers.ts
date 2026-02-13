import * as jose from 'jose'
import type { AuthUser } from '@bidradar/core'
import { createApp } from '../apps/api/src/app.js'
import type { Env } from '../apps/api/src/env.js'

export const TEST_JWT_SECRET = 'test-secret-must-be-at-least-32-chars!'
const secret = new TextEncoder().encode(TEST_JWT_SECRET)

export const TEST_ENV: Env = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://imoveis:imoveis@localhost:5432/imoveis',
  PORT: 0,
  JWT_SECRET: TEST_JWT_SECRET,
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  ADMIN_EMAILS: ['admin@test.com'],
  ALLOWED_ORIGINS: ['http://localhost:3000'],
}

export function getTestApp() {
  return createApp(TEST_ENV)
}

/**
 * Make a request to the test app with Origin header automatically set.
 * Hono's cors() middleware requires an Origin header.
 */
export async function request(
  app: ReturnType<typeof getTestApp>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  // Build a Request object ourselves to guarantee the Origin header is present.
  const url = path.startsWith('http') ? path : `http://localhost${path}`
  const headers = new Headers(init?.headers)
  if (!headers.has('Origin')) {
    headers.set('Origin', 'http://localhost:3000')
  }
  const req = new Request(url, { ...init, headers })
  return app.request(req)
}

export async function createTestToken(user: AuthUser): Promise<string> {
  return new jose.SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('bidradar')
    .setExpirationTime('1h')
    .sign(secret)
}

export async function createExpiredToken(user: AuthUser): Promise<string> {
  return new jose.SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setIssuer('bidradar')
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(secret)
}

export const TEST_ADMIN: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@test.com',
  name: 'Test Admin',
  role: 'admin',
}

export const TEST_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@test.com',
  name: 'Test User',
  role: 'free',
}
