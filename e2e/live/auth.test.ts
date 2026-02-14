import { describe, it, expect, beforeAll } from 'vitest'
import { liveRequest, getDevApiUrl } from './helpers.js'

describe('Live: Auth endpoints', () => {
  beforeAll(async () => {
    await getDevApiUrl()
  })

  describe('POST /auth/session', () => {
    it('creates a session and returns a sessionId', async () => {
      const res = await liveRequest('/auth/session', { method: 'POST' })
      expect(res.status).toBe(200)

      const body = (await res.json()) as { sessionId: string }
      expect(body.sessionId).toBeDefined()
      expect(body.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })
  })

  describe('GET /auth/login', () => {
    it('returns 400 when session parameter is missing', async () => {
      const res = await liveRequest('/auth/login')
      expect(res.status).toBe(400)
    })

    it('redirects to Google when session is valid', async () => {
      const sessionRes = await liveRequest('/auth/session', { method: 'POST' })
      const { sessionId } = (await sessionRes.json()) as { sessionId: string }

      const res = await liveRequest(`/auth/login?session=${sessionId}`, {
        redirect: 'manual',
      })
      expect(res.status).toBe(302)

      const location = res.headers.get('Location')
      expect(location).toBeDefined()
      expect(location).toContain('accounts.google.com')
    })
  })

  describe('GET /auth/callback', () => {
    it('returns 400 when code and state are missing', async () => {
      const res = await liveRequest('/auth/callback')
      expect(res.status).toBe(400)
    })

    it('returns HTML with failure message when error is present', async () => {
      const res = await liveRequest('/auth/callback?error=access_denied')
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Authentication failed')
    })
  })

  describe('GET /auth/token', () => {
    it('returns 400 when session parameter is missing', async () => {
      const res = await liveRequest('/auth/token')
      expect(res.status).toBe(400)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('VALIDATION_ERROR')
    })

    it('returns 404 for invalid/expired session', async () => {
      const res = await liveRequest(
        '/auth/token?session=00000000-0000-0000-0000-000000000000',
      )
      expect(res.status).toBe(404)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('NOT_FOUND')
    })

    it('returns pending status for a new session', async () => {
      const sessionRes = await liveRequest('/auth/session', { method: 'POST' })
      const { sessionId } = (await sessionRes.json()) as { sessionId: string }

      const res = await liveRequest(`/auth/token?session=${sessionId}`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as { status: string }
      expect(body.status).toBe('pending')
    })
  })
})
