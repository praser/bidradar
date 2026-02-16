import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./zyte-fetch.js', () => ({
  createZyteFetchBinary: vi.fn().mockReturnValue(vi.fn()),
}))

vi.mock('@bidradar/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bidradar/core')>()
  return {
    ...actual,
    downloadOfferDetails: vi.fn().mockResolvedValue({
      total: 2,
      uploaded: 1,
      skipped: 1,
      errors: 0,
    }),
  }
})

vi.mock('@bidradar/db', () => ({
  createDownloadMetadataRepository: vi.fn().mockReturnValue({
    insert: vi.fn().mockResolvedValue('download-id'),
    findByContentHash: vi.fn().mockResolvedValue(undefined),
  }),
  createOfferRepository: vi.fn().mockReturnValue({
    findOffersNeedingDetails: vi.fn().mockResolvedValue([
      { id: 'offer-1', sourceId: 'src-1', offerUrl: 'https://example.com/1' },
      { id: 'offer-2', sourceId: 'src-2', offerUrl: 'https://example.com/2' },
    ]),
  }),
}))

vi.mock('./s3-file-store.js', () => ({
  createS3FileStore: vi.fn().mockReturnValue({
    store: vi.fn().mockResolvedValue({ bucketName: 'bucket', bucketKey: 'key' }),
    get: vi.fn(),
  }),
}))

import { handler } from './download-offer-details.js'
import { downloadOfferDetails } from '@bidradar/core'
import { createOfferRepository } from '@bidradar/db'

describe('download-offer-details handler', () => {
  const originalEnv = process.env.BUCKET_NAME

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BUCKET_NAME = 'test-bucket'
    process.env.ZYTE_API_KEY = 'test-zyte-key'
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BUCKET_NAME = originalEnv
    } else {
      delete process.env.BUCKET_NAME
    }
    delete process.env.ZYTE_API_KEY
    vi.restoreAllMocks()
  })

  it('queries for pending offers and downloads details', async () => {
    const result = await handler()

    const repo = vi.mocked(createOfferRepository).mock.results[0]!.value
    expect(repo.findOffersNeedingDetails).toHaveBeenCalled()
    expect(downloadOfferDetails).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'offer-1' }),
        expect.objectContaining({ id: 'offer-2' }),
      ]),
      expect.any(Object),
      expect.objectContaining({ rateLimit: 5 }),
    )
    expect(result.statusCode).toBe(200)
    expect(result.body.uploaded).toBe(1)
    expect(result.body.skipped).toBe(1)
  })

  it('returns early when no pending offers', async () => {
    vi.mocked(createOfferRepository).mockReturnValue({
      findOffersNeedingDetails: vi.fn().mockResolvedValue([]),
    } as never)

    const result = await handler()

    expect(downloadOfferDetails).not.toHaveBeenCalled()
    expect(result.body.total).toBe(0)
  })

  it('throws if BUCKET_NAME is not set', async () => {
    delete process.env.BUCKET_NAME

    await expect(handler()).rejects.toThrow(
      'BUCKET_NAME environment variable is required',
    )
  })

  it('throws if ZYTE_API_KEY is not set', async () => {
    delete process.env.ZYTE_API_KEY

    await expect(handler()).rejects.toThrow(
      'ZYTE_API_KEY environment variable is required',
    )
  })
})
