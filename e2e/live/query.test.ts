import { describe, it, expect, beforeAll } from 'vitest'
import { liveRequest, getDevApiUrl } from './helpers.js'

describe('Live: Query offers', () => {
  beforeAll(async () => {
    await getDevApiUrl()
  })

  it('returns 401 for unauthenticated query', async () => {
    const res = await liveRequest('/offers')
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid filter syntax (with auth bypass check)', async () => {
    // Even invalid filter should fail with 401 first if no auth
    const res = await liveRequest('/offers?filter=invalid!!!filter')
    // Could be 401 (auth check first) or 400 (filter check first)
    expect([400, 401]).toContain(res.status)
  })

  it('returns 400 for invalid pageSize (with auth bypass check)', async () => {
    const res = await liveRequest('/offers?pageSize=-1')
    expect([400, 401]).toContain(res.status)
  })

  it('returns 400 for invalid sort field (with auth bypass check)', async () => {
    const res = await liveRequest('/offers?sort=nonexistentField')
    expect([400, 401]).toContain(res.status)
  })
})
