import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {},
  PutObjectCommand: class {},
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

vi.mock('@bidradar/db', () => ({
  createDownloadMetadataRepository: vi.fn().mockReturnValue({
    insert: vi.fn().mockResolvedValue('download-id-1'),
    findByContentHash: vi.fn().mockResolvedValue(undefined),
  }),
  createOfferRepository: vi.fn().mockReturnValue({
    findOffersNeedingDetails: vi.fn().mockResolvedValue([
      { id: 'offer-1', sourceId: 'src-1', offerUrl: 'https://example.com/1' },
      { id: 'offer-2', sourceId: 'src-2', offerUrl: 'https://example.com/2' },
    ]),
  }),
}))

import { Hono } from 'hono'
import { managementRoutes } from './management.js'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createDownloadMetadataRepository, createOfferRepository } from '@bidradar/db'
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

  it('accepts new file types', async () => {
    const app = createAuthenticatedApp(makeEnv())

    for (const fileType of ['auctions-schedule', 'licensed-brokers', 'accredited-auctioneers']) {
      const res = await app.request('/management/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileType }),
      })
      expect(res.status).toBe(200)
    }
  })
})

describe('POST /management/check-hash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns exists: false when hash is not found', async () => {
    const app = createAuthenticatedApp(makeEnv())
    const hash = 'a'.repeat(64)

    const res = await app.request('/management/check-hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentHash: hash }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.exists).toBe(false)
  })

  it('returns exists: true when hash is found', async () => {
    const repo = vi.mocked(createDownloadMetadataRepository)
    repo.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue('download-id-1'),
      findByContentHash: vi.fn().mockResolvedValue({ id: 'existing-id' }),
    })

    const app = createAuthenticatedApp(makeEnv())
    const hash = 'b'.repeat(64)

    const res = await app.request('/management/check-hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentHash: hash }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.exists).toBe(true)
  })

  it('rejects invalid hash length', async () => {
    const app = createAuthenticatedApp(makeEnv())

    const res = await app.request('/management/check-hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentHash: 'tooshort' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('POST /management/record-download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records download metadata and returns downloadId', async () => {
    const app = createAuthenticatedApp(makeEnv())

    const res = await app.request('/management/record-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'test.pdf',
        fileExtension: 'pdf',
        fileSize: 1024,
        fileType: 'auctions-schedule',
        downloadUrl: 'https://example.com/file.pdf',
        downloadedAt: '2026-02-14T10:00:00Z',
        bucketName: 'test-bucket',
        bucketKey: 'cef-downloads/auctions-schedule/2026-02-14.auctions-schedule.abc12345.pdf',
        contentHash: 'a'.repeat(64),
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.downloadId).toBe('download-id-1')
  })

  it('rejects invalid request body', async () => {
    const app = createAuthenticatedApp(makeEnv())

    const res = await app.request('/management/record-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'test.pdf' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /management/pending-offer-details', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns offers needing detail downloads', async () => {
    const app = createAuthenticatedApp(makeEnv())

    const res = await app.request('/management/pending-offer-details')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.offers).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.offers[0].id).toBe('offer-1')
  })

  it('respects limit parameter', async () => {
    const app = createAuthenticatedApp(makeEnv())

    const res = await app.request('/management/pending-offer-details?limit=1')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.offers).toHaveLength(1)
    expect(body.total).toBe(2)
  })
})
