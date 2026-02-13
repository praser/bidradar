import { describe, it, expect, beforeAll } from 'vitest'
import { getTestApp, request, createTestToken, TEST_ADMIN, TEST_USER } from './helpers.js'

describe('GET /users/me', () => {
  const app = getTestApp()
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    adminToken = await createTestToken(TEST_ADMIN)
    userToken = await createTestToken(TEST_USER)
  })

  it('returns 401 without auth header', async () => {
    const res = await request(app, '/users/me')
    expect(res.status).toBe(401)
  })

  it('returns admin user info from JWT payload', async () => {
    const res = await request(app, '/users/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      id: string
      email: string
      name: string
      role: string
    }
    expect(body.id).toBe(TEST_ADMIN.id)
    expect(body.email).toBe(TEST_ADMIN.email)
    expect(body.name).toBe(TEST_ADMIN.name)
    expect(body.role).toBe('admin')
  })

  it('returns free user info from JWT payload', async () => {
    const res = await request(app, '/users/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      id: string
      email: string
      name: string
      role: string
    }
    expect(body.id).toBe(TEST_USER.id)
    expect(body.email).toBe(TEST_USER.email)
    expect(body.name).toBe(TEST_USER.name)
    expect(body.role).toBe('free')
  })
})
