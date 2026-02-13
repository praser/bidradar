import { describe, it, expect } from 'vitest'
import { getTestApp, request } from './helpers.js'

describe('GET /health', () => {
  const app = getTestApp()

  it('returns 200 with status ok', async () => {
    const res = await request(app, '/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
