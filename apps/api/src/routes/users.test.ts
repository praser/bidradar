import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import type { AuthEnv } from '../middleware/authenticate.js'
import { userRoutes } from './users.js'

function createTestApp() {
  const app = new Hono<AuthEnv>()

  // Fake authenticate middleware
  app.use('*', async (c, next) => {
    c.set('user', {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    })
    await next()
  })

  app.route('/users', userRoutes())
  return app
}

describe('GET /users/me', () => {
  it('returns the authenticated user', async () => {
    const app = createTestApp()
    const res = await app.request('/users/me')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    })
  })
})
