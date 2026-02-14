import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@bidradar/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bidradar/core')>()
  return {
    ...actual,
    downloadCefFile: vi.fn().mockResolvedValue({
      outcome: 'uploaded',
      contentHash: 'a'.repeat(64),
      fileSize: 1024,
      s3Key: 'cef-downloads/auctions-schedule/2026-02-14.auctions-schedule.abc12345.pdf',
      downloadId: 'download-id-1',
    }),
  }
})

vi.mock('@bidradar/db', () => ({
  createDownloadMetadataRepository: vi.fn().mockReturnValue({
    insert: vi.fn().mockResolvedValue('download-id'),
    findByContentHash: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('./s3-file-store.js', () => ({
  createS3FileStore: vi.fn().mockReturnValue({
    store: vi.fn().mockResolvedValue({ bucketName: 'bucket', bucketKey: 'key' }),
    get: vi.fn(),
  }),
}))

import { handler } from './download-cef-files.js'
import { downloadCefFile } from '@bidradar/core'

describe('download-cef-files handler', () => {
  const originalEnv = process.env.BUCKET_NAME

  beforeEach(() => {
    process.env.BUCKET_NAME = 'test-bucket'
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BUCKET_NAME = originalEnv
    } else {
      delete process.env.BUCKET_NAME
    }
    vi.restoreAllMocks()
  })

  it('downloads all 3 bulk file types', async () => {
    const result = await handler()

    expect(downloadCefFile).toHaveBeenCalledTimes(3)
    expect(downloadCefFile).toHaveBeenCalledWith(
      'auctions-schedule',
      expect.any(Object),
    )
    expect(downloadCefFile).toHaveBeenCalledWith(
      'licensed-brokers',
      expect.any(Object),
    )
    expect(downloadCefFile).toHaveBeenCalledWith(
      'accredited-auctioneers',
      expect.any(Object),
    )
    expect(result.statusCode).toBe(200)
    expect(result.body.results).toHaveLength(3)
  })

  it('throws if BUCKET_NAME is not set', async () => {
    delete process.env.BUCKET_NAME

    await expect(handler()).rejects.toThrow(
      'BUCKET_NAME environment variable is required',
    )
  })
})
