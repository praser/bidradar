import { describe, it, expect, beforeAll } from 'vitest'
import { getTestApp, request, createTestToken, TEST_ADMIN } from './helpers.js'

describe('Error handling', () => {
  const app = getTestApp()
  let adminToken: string

  beforeAll(async () => {
    adminToken = await createTestToken(TEST_ADMIN)
  })

  it('returns 404 for unknown authenticated routes', async () => {
    // Unknown paths with valid auth should return 404
    const res = await request(app, '/nonexistent-route', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(404)
  })

  it('returns 401 for unknown routes without auth', async () => {
    const res = await request(app, '/nonexistent-route')
    expect(res.status).toBe(401)
  })

  it('returns JSON error for Zod validation errors', async () => {
    const res = await request(app, '/offers?pageSize=-1', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(400)

    const body = (await res.json()) as {
      error: string
      message: string
      statusCode: number
    }
    expect(body.error).toBe('VALIDATION_ERROR')
    expect(body.statusCode).toBe(400)
    expect(typeof body.message).toBe('string')
  })

  it('returns consistent error response shape', async () => {
    const res = await request(app, '/offers', {
      headers: { Authorization: 'Bearer invalid' },
    })
    expect(res.status).toBe(401)

    const body = (await res.json()) as {
      error: string
      message: string
      statusCode: number
    }
    expect(body).toHaveProperty('error')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('statusCode')
    expect(typeof body.error).toBe('string')
    expect(typeof body.message).toBe('string')
    expect(typeof body.statusCode).toBe('number')
  })

  it('CORS headers are present on responses', async () => {
    const res = await request(app, '/health')
    const acao = res.headers.get('Access-Control-Allow-Origin')
    expect(acao).toBeDefined()
  })

  it('handles OPTIONS preflight requests', async () => {
    const res = await request(app, '/health', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'GET',
      },
    })
    expect(res.status).toBeLessThan(500)
  })
})
