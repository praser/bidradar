import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { authorize } from './authorize.js'
import type { AuthEnv } from './authenticate.js'
import type { AuthUser } from '@bidradar/core'

function createTestApp(allowedRoles: AuthUser['role'][]) {
  const app = new Hono<AuthEnv>()

  // Fake authenticate middleware that sets user directly
  app.use('*', async (c, next) => {
    const role = c.req.header('X-Test-Role') as AuthUser['role']
    c.set('user', {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      role: role ?? 'free',
    })
    await next()
  })

  app.use('*', authorize(...allowedRoles))
  app.get('/test', (c) => c.json({ ok: true }))
  return app
}

describe('authorize middleware', () => {
  it('allows user with matching role', async () => {
    const app = createTestApp(['admin'])
    const res = await app.request('/test', {
      headers: { 'X-Test-Role': 'admin' },
    })
    expect(res.status).toBe(200)
  })

  it('rejects user without matching role', async () => {
    const app = createTestApp(['admin'])
    const res = await app.request('/test', {
      headers: { 'X-Test-Role': 'free' },
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('FORBIDDEN')
  })

  it('accepts any of multiple allowed roles', async () => {
    const app = createTestApp(['admin', 'free'])
    const res = await app.request('/test', {
      headers: { 'X-Test-Role': 'free' },
    })
    expect(res.status).toBe(200)
  })
})
