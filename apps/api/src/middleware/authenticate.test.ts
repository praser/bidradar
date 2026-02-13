import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import * as jose from 'jose'
import { authenticate, type AuthEnv } from './authenticate.js'

const JWT_SECRET = 'a-very-secret-key-that-is-at-least-32-characters-long!!'
const secret = new TextEncoder().encode(JWT_SECRET)

async function createToken(
  payload: Record<string, unknown>,
  expiresIn = '1h',
) {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('bidradar')
    .setExpirationTime(expiresIn)
    .sign(secret)
}

function createTestApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', authenticate(JWT_SECRET))
  app.get('/test', (c) => {
    const user = c.get('user')
    return c.json(user)
  })
  return app
}

describe('authenticate middleware', () => {
  it('returns 401 when no Authorization header', async () => {
    const app = createTestApp()
    const res = await app.request('/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('UNAUTHORIZED')
  })

  it('returns 401 when Authorization is not Bearer', async () => {
    const app = createTestApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Basic abc123' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    const app = createTestApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toBe('Invalid or expired token')
  })

  it('sets user in context for valid token', async () => {
    const app = createTestApp()
    const token = await createToken({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    })

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const user = await res.json()
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.email).toBe('test@example.com')
    expect(user.name).toBe('Test User')
    expect(user.role).toBe('admin')
  })

  it('returns 401 for expired token', async () => {
    const app = createTestApp()
    const token = await createToken(
      {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        name: 'Test User',
        role: 'free',
      },
      '0s',
    )

    // Wait a moment to ensure expiration
    await new Promise((r) => setTimeout(r, 1100))

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })
})
