import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { getTestApp, request, TEST_ENV } from './helpers.js'
import { cleanDatabase, closeTestDb, verifyDatabaseConnection } from './db-setup.js'

describe('Auth endpoints', () => {
  const app = getTestApp()
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await verifyDatabaseConnection()
  })

  beforeEach(async () => {
    if (!dbAvailable) return
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  describe('POST /auth/session', () => {
    it('creates a new session and returns a sessionId', async () => {
      if (!dbAvailable) return

      const res = await request(app, '/auth/session', { method: 'POST' })
      expect(res.status).toBe(200)

      const body = (await res.json()) as { sessionId: string }
      expect(body.sessionId).toBeDefined()
      expect(typeof body.sessionId).toBe('string')
      expect(body.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })
  })

  describe('GET /auth/login', () => {
    it('returns 400 when session parameter is missing', async () => {
      const res = await request(app, '/auth/login')
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid session', async () => {
      if (!dbAvailable) return

      const res = await request(app, '/auth/login?session=invalid-session-id')
      expect(res.status).toBe(400)
    })

    it('redirects to Google when session is valid', async () => {
      if (!dbAvailable) return

      const sessionRes = await request(app, '/auth/session', { method: 'POST' })
      const { sessionId } = (await sessionRes.json()) as { sessionId: string }

      const res = await request(app, `/auth/login?session=${sessionId}`)
      expect(res.status).toBe(302)

      const location = res.headers.get('Location')
      expect(location).toBeDefined()
      expect(location).toContain('accounts.google.com')
      expect(location).toContain(TEST_ENV.GOOGLE_CLIENT_ID)
      expect(location).toContain(sessionId)
    })
  })

  describe('GET /auth/callback', () => {
    it('returns 400 when code and state are missing', async () => {
      const res = await request(app, '/auth/callback')
      expect(res.status).toBe(400)
    })

    it('returns HTML with failure message when error is present', async () => {
      const res = await request(app, '/auth/callback?error=access_denied')
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Authentication failed')
    })

    it('returns 400 for invalid session state', async () => {
      if (!dbAvailable) return

      const res = await request(
        app,
        '/auth/callback?code=test&state=invalid-session',
      )
      expect(res.status).toBe(400)
    })
  })

  describe('GET /auth/token', () => {
    it('returns 400 when session parameter is missing', async () => {
      const res = await request(app, '/auth/token')
      expect(res.status).toBe(400)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('VALIDATION_ERROR')
    })

    it('returns 404 for invalid/expired session', async () => {
      if (!dbAvailable) return

      const res = await request(
        app,
        '/auth/token?session=00000000-0000-0000-0000-000000000000',
      )
      expect(res.status).toBe(404)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('NOT_FOUND')
    })

    it('returns pending status for active session without result', async () => {
      if (!dbAvailable) return

      const sessionRes = await request(app, '/auth/session', { method: 'POST' })
      const { sessionId } = (await sessionRes.json()) as { sessionId: string }

      const res = await request(app, `/auth/token?session=${sessionId}`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as { status: string }
      expect(body.status).toBe('pending')
    })
  })
})
