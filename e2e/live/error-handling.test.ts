import { describe, it, expect, beforeAll } from 'vitest'
import { liveRequest, getDevApiUrl } from './helpers.js'

describe('Live: Error handling', () => {
  beforeAll(async () => {
    await getDevApiUrl()
  })

  it('returns 401 for protected routes without auth', async () => {
    const res = await liveRequest('/offers')
    expect(res.status).toBe(401)

    const body = (await res.json()) as { error: string; message: string; statusCode: number }
    expect(body.error).toBe('UNAUTHORIZED')
    expect(body.statusCode).toBe(401)
  })

  it('returns 401 for invalid Bearer token', async () => {
    const res = await liveRequest('/offers', {
      headers: { Authorization: 'Bearer not-a-valid-jwt' },
    })
    expect(res.status).toBe(401)

    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('UNAUTHORIZED')
  })

  it('returns consistent error response shape for 401', async () => {
    const res = await liveRequest('/offers')
    expect(res.status).toBe(401)

    const body = (await res.json()) as { error: string; message: string; statusCode: number }
    expect(body).toHaveProperty('error')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('statusCode')
    expect(typeof body.error).toBe('string')
    expect(typeof body.message).toBe('string')
    expect(typeof body.statusCode).toBe('number')
  })

  it('returns 401 for unknown routes without auth', async () => {
    const res = await liveRequest('/nonexistent-route')
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid auth/login without session', async () => {
    const res = await liveRequest('/auth/login')
    expect(res.status).toBe(400)
  })
})
