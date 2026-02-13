import { describe, it, expect, beforeAll } from 'vitest'
import { getTestApp, request, createTestToken, TEST_ADMIN, TEST_USER } from './helpers.js'

describe('POST /reconcile/:source', () => {
  const app = getTestApp()
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    adminToken = await createTestToken(TEST_ADMIN)
    userToken = await createTestToken(TEST_USER)
  })

  describe('authorization', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app, '/reconcile/cef', { method: 'POST' })
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin user', async () => {
      const res = await request(app, '/reconcile/cef', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
      })
      expect(res.status).toBe(403)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('FORBIDDEN')
      expect(body.message).toContain('Insufficient permissions')
    })

    it('allows admin user access', async () => {
      // This will attempt to actually download from CEF, which may fail,
      // but the point is it should not return 401 or 403
      const res = await request(app, '/reconcile/cef', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(403)
    })
  })

  describe('source validation', () => {
    it('returns 400 for unknown source', async () => {
      const res = await request(app, '/reconcile/unknown', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('NDJSON streaming', () => {
    it('returns application/x-ndjson content type for cef source', async () => {
      const res = await request(app, '/reconcile/cef', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (res.status === 200) {
        expect(res.headers.get('Content-Type')).toContain('application/x-ndjson')
      }
    })

    it('streams NDJSON events with valid JSON on each line', async () => {
      const res = await request(app, '/reconcile/cef', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      if (res.status === 200 && res.body) {
        const text = await res.text()
        const lines = text.split('\n').filter((l) => l.trim().length > 0)

        for (const line of lines) {
          expect(() => JSON.parse(line)).not.toThrow()
        }

        expect(lines.length).toBeGreaterThan(0)

        const firstEvent = JSON.parse(lines[0]!) as { type: string }
        expect(['start', 'error']).toContain(firstEvent.type)
      }
    })
  })

  describe('query parameters', () => {
    it('accepts uf query parameter', async () => {
      const res = await request(app, '/reconcile/cef?uf=DF', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).not.toBe(400)
      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(403)
    })
  })
})
