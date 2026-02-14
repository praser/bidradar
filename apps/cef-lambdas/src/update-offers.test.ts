import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@bidradar/cef', () => ({
  downloadFile: vi.fn(),
  parseOffers: vi.fn(),
}))

vi.mock('@bidradar/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bidradar/core')>()
  return {
    ...actual,
    updateCefOffers: vi.fn(),
  }
})

vi.mock('@bidradar/db', () => ({
  createOfferRepository: vi.fn().mockReturnValue({}),
  createDownloadMetadataRepository: vi.fn().mockReturnValue({}),
}))

vi.mock('./s3-file-store.js', () => ({
  createS3FileStore: vi.fn().mockReturnValue({}),
}))

import { handler } from './update-offers.js'
import { updateCefOffers } from '@bidradar/core'
import { createS3FileStore } from './s3-file-store.js'
import {
  createOfferRepository,
  createDownloadMetadataRepository,
} from '@bidradar/db'

describe('update-offers handler', () => {
  const originalEnv = process.env.BUCKET_NAME

  beforeEach(() => {
    process.env.BUCKET_NAME = 'test-bucket'
    vi.mocked(updateCefOffers).mockResolvedValue({
      fileSize: 1000,
      totalOffers: 50,
      states: 3,
      results: new Map(),
    })
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BUCKET_NAME = originalEnv
    } else {
      delete process.env.BUCKET_NAME
    }
    vi.restoreAllMocks()
  })

  it('calls updateCefOffers with wired dependencies', async () => {
    await handler()

    expect(updateCefOffers).toHaveBeenCalledTimes(1)
    const deps = vi.mocked(updateCefOffers).mock.calls[0]![0]
    expect(deps).toHaveProperty('fetchOffersCsv')
    expect(deps).toHaveProperty('parseOffers')
    expect(deps).toHaveProperty('fileStore')
    expect(deps).toHaveProperty('metadataRepo')
    expect(deps).toHaveProperty('offerRepo')
  })

  it('creates S3 file store with BUCKET_NAME from env', async () => {
    await handler()

    expect(createS3FileStore).toHaveBeenCalledWith('test-bucket')
  })

  it('creates repositories', async () => {
    await handler()

    expect(createOfferRepository).toHaveBeenCalled()
    expect(createDownloadMetadataRepository).toHaveBeenCalled()
  })

  it('throws if BUCKET_NAME is not set', async () => {
    delete process.env.BUCKET_NAME

    await expect(handler()).rejects.toThrow(
      'BUCKET_NAME environment variable is required',
    )
  })

  it('returns status 200 with summary', async () => {
    const result = await handler()

    expect(result).toEqual({
      statusCode: 200,
      body: {
        fileSize: 1000,
        totalOffers: 50,
        states: 3,
      },
    })
  })
})
