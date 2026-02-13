import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../env.js'

const mockSessionRepo = {
  create: vi.fn().mockResolvedValue(undefined),
  find: vi.fn(),
  setResult: vi.fn().mockResolvedValue(undefined),
  setError: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  cleanExpired: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@bidradar/db', () => ({
  createUserRepository: vi.fn(),
  createAuthSessionRepository: vi.fn(() => mockSessionRepo),
}))

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid'),
}))

import { authRoutes } from './auth.js'

const testEnv: Env = {
  DATABASE_URL: 'postgresql://localhost/test',
  PORT: 3000,
  JWT_SECRET: 'a-very-secret-key-that-is-at-least-32-characters-long!!',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  ADMIN_EMAILS: ['admin@example.com'],
}

function createTestApp() {
  const app = new Hono()
  app.route('/auth', authRoutes(testEnv))
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /auth/session', () => {
  it('creates a session and returns sessionId', async () => {
    const app = createTestApp()
    const res = await app.request('/auth/session', { method: 'POST' })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.sessionId).toBe('mock-uuid')
    expect(mockSessionRepo.cleanExpired).toHaveBeenCalledOnce()
    expect(mockSessionRepo.create).toHaveBeenCalledWith('mock-uuid', expect.any(Date))
  })
})

describe('GET /auth/login', () => {
  it('returns 400 when session parameter is missing', async () => {
    const app = createTestApp()
    const res = await app.request('/auth/login')
    expect(res.status).toBe(400)

    const body = await res.text()
    expect(body).toBe('Invalid or expired session')
  })

  it('returns 400 when session is not found', async () => {
    mockSessionRepo.find.mockResolvedValue(null)
    const app = createTestApp()

    const res = await app.request('/auth/login?session=invalid-session')
    expect(res.status).toBe(400)
  })

  it('redirects to Google OAuth when session is valid', async () => {
    mockSessionRepo.find.mockResolvedValue({
      id: 'sess-123',
      result: null,
      error: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
    })
    const app = createTestApp()

    const res = await app.request('/auth/login?session=sess-123')
    expect(res.status).toBe(302)

    const location = res.headers.get('Location')!
    expect(location).toContain('accounts.google.com')
    expect(location).toContain('client_id=test-google-client-id')
    expect(location).toContain('state=sess-123')
    expect(location).toContain('scope=openid+email+profile')
  })
})

describe('GET /auth/callback', () => {
  it('returns 400 when code or state is missing', async () => {
    const app = createTestApp()
    const res = await app.request('/auth/callback')
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Missing code or state')
  })

  it('handles error parameter from Google', async () => {
    mockSessionRepo.find.mockResolvedValue({
      id: 'sess-123',
      result: null,
      error: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
    })
    const app = createTestApp()

    const res = await app.request('/auth/callback?error=access_denied&state=sess-123')
    expect(res.status).toBe(200)

    const html = await res.text()
    expect(html).toContain('Authentication failed')
    expect(mockSessionRepo.setError).toHaveBeenCalledWith('sess-123', 'access_denied')
  })

  it('returns 400 when session is invalid', async () => {
    mockSessionRepo.find.mockResolvedValue(null)
    const app = createTestApp()

    const res = await app.request('/auth/callback?code=auth-code&state=invalid-session')
    expect(res.status).toBe(400)
  })
})

describe('GET /auth/token', () => {
  it('returns 400 when session parameter is missing', async () => {
    const app = createTestApp()
    const res = await app.request('/auth/token')
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when session is not found', async () => {
    mockSessionRepo.find.mockResolvedValue(null)
    const app = createTestApp()

    const res = await app.request('/auth/token?session=invalid')
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.error).toBe('NOT_FOUND')
  })

  it('returns 401 when session has an error', async () => {
    mockSessionRepo.find.mockResolvedValue({
      id: 'sess-123',
      result: null,
      error: 'access_denied',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
    })
    const app = createTestApp()

    const res = await app.request('/auth/token?session=sess-123')
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error).toBe('UNAUTHORIZED')
    expect(body.message).toBe('access_denied')
    expect(mockSessionRepo.delete).toHaveBeenCalledWith('sess-123')
  })

  it('returns result when session is complete', async () => {
    const sessionResult = {
      token: 'jwt-token',
      user: { id: '1', email: 'test@test.com', name: 'Test', role: 'admin' },
    }
    mockSessionRepo.find.mockResolvedValue({
      id: 'sess-123',
      result: sessionResult,
      error: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
    })
    const app = createTestApp()

    const res = await app.request('/auth/token?session=sess-123')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual(sessionResult)
    expect(mockSessionRepo.delete).toHaveBeenCalledWith('sess-123')
  })

  it('returns pending status when session is still waiting', async () => {
    mockSessionRepo.find.mockResolvedValue({
      id: 'sess-123',
      result: null,
      error: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
    })
    const app = createTestApp()

    const res = await app.request('/auth/token?session=sess-123')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('pending')
  })
})
