import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@bidradar/cef', () => ({
  downloadFile: vi.fn(),
}))

vi.mock('@bidradar/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bidradar/core')>()
  return {
    ...actual,
    buildCefS3Key: vi.fn().mockReturnValue('cef-downloads/offer-list/2026-02-14.geral.abc12345.csv'),
  }
})

vi.mock('./s3-file-store.js', () => ({
  createS3FileStore: vi.fn().mockReturnValue({
    store: vi.fn().mockResolvedValue({
      bucketName: 'test-bucket',
      bucketKey: 'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    }),
  }),
}))

import { PassThrough } from 'node:stream'
import { handler } from './download-offers.js'
import { downloadFile } from '@bidradar/cef'
import { createS3FileStore } from './s3-file-store.js'

describe('download-offers handler', () => {
  const originalEnv = process.env.BUCKET_NAME

  beforeEach(() => {
    process.env.BUCKET_NAME = 'test-bucket'
    const stream = new PassThrough()
    stream.end(Buffer.from('csv-content'))
    vi.mocked(downloadFile).mockResolvedValue(stream)
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BUCKET_NAME = originalEnv
    } else {
      delete process.env.BUCKET_NAME
    }
    vi.restoreAllMocks()
  })

  it('downloads CSV and stores in S3', async () => {
    const result = await handler()

    expect(downloadFile).toHaveBeenCalledWith('geral')
    expect(createS3FileStore).toHaveBeenCalledWith('test-bucket')
    const fileStore = vi.mocked(createS3FileStore).mock.results[0]!.value
    expect(fileStore.store).toHaveBeenCalledWith({
      key: 'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
      content: expect.any(Buffer),
      contentType: 'text/csv',
    })
    expect(result.statusCode).toBe(200)
  })

  it('throws if BUCKET_NAME is not set', async () => {
    delete process.env.BUCKET_NAME

    await expect(handler()).rejects.toThrow(
      'BUCKET_NAME environment variable is required',
    )
  })

  it('returns file size and S3 key', async () => {
    const result = await handler()

    expect(result.body.fileSize).toBe(11)
    expect(result.body.s3Key).toBe(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )
  })
})
