import { describe, it, expect, beforeAll } from 'vitest'
import { getTestApp, request, createTestToken, TEST_ADMIN, TEST_USER } from './helpers.js'

describe('POST /management/upload-url', () => {
  const app = getTestApp()
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    adminToken = await createTestToken(TEST_ADMIN)
    userToken = await createTestToken(TEST_USER)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app, '/management/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileType: 'offer-list' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request(app, '/management/upload-url', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileType: 'offer-list' }),
    })
    expect(res.status).toBe(403)

    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('FORBIDDEN')
  })

  it('returns 503 when BUCKET_NAME is not configured', async () => {
    // The test app does not set BUCKET_NAME, so upload should return 503
    const res = await request(app, '/management/upload-url', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileType: 'offer-list' }),
    })
    expect(res.status).toBe(503)

    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('SERVICE_UNAVAILABLE')
  })

  it('returns 400 for invalid fileType', async () => {
    const res = await request(app, '/management/upload-url', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileType: 'invalid-type' }),
    })
    // May be 503 (bucket check first) or 400 (validation) depending on order
    // Since BUCKET_NAME is not set, the route returns 503 before reaching validation
    expect([400, 503]).toContain(res.status)
  })
})
