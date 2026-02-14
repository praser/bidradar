import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {}, // must be a class for `new S3Client({})`
  PutObjectCommand: class {}, // must be a class for `new PutObjectCommand(...)`
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi
    .fn()
    .mockResolvedValue('https://s3.amazonaws.com/presigned-url'),
}))

vi.mock('@bidradar/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bidradar/core')>()
  return {
    ...actual,
    buildCefS3Key: vi
      .fn()
      .mockReturnValue(
        'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
      ),
  }
})

import { Hono } from 'hono'
import { managementRoutes } from './management.js'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Env } from '../env.js'

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DATABASE_URL: 'postgresql://localhost/test',
    PORT: 3000,
    JWT_SECRET: 'a'.repeat(32),
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    ADMIN_EMAILS: ['admin@example.com'],
    BUCKET_NAME: 'test-bucket',
    ...overrides,
  }
}

function createAuthenticatedApp(env: Env, role: string = 'admin') {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('user' as never, {
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role,
    })
    await next()
  })
  app.route('/management', managementRoutes(env))
  return app
}

describe('POST /management/upload-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns presigned URL for valid request', async () => {
    const app = createAuthenticatedApp(makeEnv())
    const res = await app.request('/management/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileType: 'offer-list' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uploadUrl).toBe('https://s3.amazonaws.com/presigned-url')
    expect(body.s3Key).toBe(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )
    expect(body.expiresIn).toBe(300)
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('returns 503 when BUCKET_NAME is not configured', async () => {
    const app = createAuthenticatedApp(makeEnv({ BUCKET_NAME: undefined }))
    const res = await app.request('/management/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileType: 'offer-list' }),
    })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('SERVICE_UNAVAILABLE')
  })

  it('rejects invalid fileType', async () => {
    const app = createAuthenticatedApp(makeEnv())
    const res = await app.request('/management/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileType: 'invalid-type' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
  })

  it('rejects non-admin users', async () => {
    const app = createAuthenticatedApp(makeEnv(), 'free')
    const res = await app.request('/management/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileType: 'offer-list' }),
    })

    expect(res.status).toBe(403)
  })
})
