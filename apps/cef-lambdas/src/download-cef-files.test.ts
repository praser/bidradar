import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./zyte-fetch.js', () => ({
  createZyteFetchBinary: vi.fn().mockReturnValue(vi.fn()),
}))

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

  it('throws if ZYTE_API_KEY is not set', async () => {
    delete process.env.ZYTE_API_KEY

    await expect(handler()).rejects.toThrow(
      'ZYTE_API_KEY environment variable is required',
    )
  })

  it('continues processing remaining files when one fails', async () => {
    vi.mocked(downloadCefFile)
      .mockResolvedValueOnce({
        outcome: 'uploaded',
        contentHash: 'a'.repeat(64),
        fileSize: 1024,
        s3Key: 'key1',
        downloadId: 'id1',
      })
      .mockRejectedValueOnce(new Error('Zyte API error 520: Website Ban'))
      .mockResolvedValueOnce({
        outcome: 'uploaded',
        contentHash: 'b'.repeat(64),
        fileSize: 2048,
        s3Key: 'key2',
        downloadId: 'id2',
      })

    const result = await handler()

    expect(downloadCefFile).toHaveBeenCalledTimes(3)
    expect(result.statusCode).toBe(200)
    expect(result.body.results).toHaveLength(3)
    expect(result.body.results[0]!.outcome).toBe('uploaded')
    expect(result.body.results[1]!.outcome).toBe('error')
    expect(result.body.results[1]!.error).toContain('520')
    expect(result.body.results[2]!.outcome).toBe('uploaded')
  })
})
