import { describe, it, expect, beforeAll } from 'vitest'
import { liveRequest, getDevApiUrl } from './helpers.js'

describe('Live: GET /health', () => {
  beforeAll(() => {
    // Will throw if DEV_API_URL is not set, causing all tests to skip
    getDevApiUrl()
  })

  it('returns 200 with status ok', async () => {
    const res = await liveRequest('/health')
    expect(res.status).toBe(200)

    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })

  it('responds within a reasonable time', async () => {
    const start = Date.now()
    const res = await liveRequest('/health')
    const elapsed = Date.now() - start

    expect(res.status).toBe(200)
    // Allow up to 10 seconds for cold start
    expect(elapsed).toBeLessThan(10_000)
  })
})
