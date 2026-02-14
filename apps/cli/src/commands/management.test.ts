import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@bidradar/cef', () => ({
  downloadFile: vi.fn(),
}))

vi.mock('../lib/apiClient.js', () => ({
  apiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public readonly statusCode: number,
      public readonly errorCode: string,
      message: string,
    ) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

import { PassThrough } from 'node:stream'
import { manager } from './management.js'
import { downloadFile } from '@bidradar/cef'
import { apiRequest, ApiError } from '../lib/apiClient.js'

// Suppress ora output in tests
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  }),
}))

describe('manager download command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined

    const stream = new PassThrough()
    stream.end(Buffer.from('csv-data'))
    vi.mocked(downloadFile).mockResolvedValue(stream)

    // Mock sequential apiRequest calls:
    // 1. check-hash -> not exists
    // 2. upload-url -> presigned URL
    // 3. record-download -> download ID
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ exists: false }) // check-hash
      .mockResolvedValueOnce({
        uploadUrl: 'https://s3.amazonaws.com/presigned',
        s3Key: 'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
        expiresIn: 300,
      }) // upload-url
      .mockResolvedValueOnce({ downloadId: 'download-id-1' }) // record-download

    // Mock global fetch for S3 upload
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    )
  })

  it('has download subcommand', () => {
    const downloadCmd = manager.commands.find((c) => c.name() === 'download')
    expect(downloadCmd).toBeDefined()
  })

  it('downloads, checks hash, gets presigned URL, uploads, and records', async () => {
    await manager.parseAsync(['download', 'offer-list'], { from: 'user' })

    expect(downloadFile).toHaveBeenCalledWith('geral')
    expect(apiRequest).toHaveBeenCalledWith('POST', '/management/check-hash', {
      body: { contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    })
    expect(apiRequest).toHaveBeenCalledWith('POST', '/management/upload-url', {
      body: { fileType: 'offer-list' },
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://s3.amazonaws.com/presigned',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'text/csv' },
      }),
    )
    expect(apiRequest).toHaveBeenCalledWith(
      'POST',
      '/management/record-download',
      expect.objectContaining({
        body: expect.objectContaining({
          fileType: 'offer-list',
          fileExtension: 'csv',
        }),
      }),
    )
  })

  it('skips upload when content hash already exists', async () => {
    vi.mocked(apiRequest).mockReset()
    vi.mocked(apiRequest).mockResolvedValueOnce({ exists: true }) // check-hash

    await manager.parseAsync(['download', 'offer-list'], { from: 'user' })

    expect(downloadFile).toHaveBeenCalledWith('geral')
    expect(apiRequest).toHaveBeenCalledTimes(1) // only check-hash
    expect(fetch).not.toHaveBeenCalled() // no S3 upload
  })

  it('sets exit code on API 401 error', async () => {
    const MockApiError = vi.mocked(ApiError)
    vi.mocked(apiRequest).mockReset()
    vi.mocked(apiRequest).mockRejectedValue(
      new MockApiError(401, 'UNAUTHORIZED', 'Not authenticated'),
    )

    await manager.parseAsync(['download', 'offer-list'], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })

  it('sets exit code on API 403 error', async () => {
    const MockApiError = vi.mocked(ApiError)
    vi.mocked(apiRequest).mockReset()
    vi.mocked(apiRequest).mockRejectedValue(
      new MockApiError(403, 'FORBIDDEN', 'Insufficient permissions'),
    )

    await manager.parseAsync(['download', 'offer-list'], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })

  it('sets exit code for unknown file type', async () => {
    await manager.parseAsync(['download', 'nonexistent'], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })
})

describe('manager download offer-details', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined

    // Mock: pending-offer-details -> check-hash -> upload-url -> record-download
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        offers: [
          { id: 'offer-1', sourceId: 'src-1', offerUrl: 'https://example.com/1' },
        ],
        total: 1,
      }) // pending-offer-details
      .mockResolvedValueOnce({ exists: false }) // check-hash
      .mockResolvedValueOnce({
        uploadUrl: 'https://s3.amazonaws.com/presigned',
        s3Key: 'cef-downloads/offer-details/offer-1/2026-02-14.offer-details.abc12345.html',
        expiresIn: 300,
      }) // upload-url
      .mockResolvedValueOnce({ downloadId: 'download-id-1' }) // record-download

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      }),
    )
  })

  it('fetches pending offers and downloads details', async () => {
    await manager.parseAsync(['download', 'offer-details', '--rate-limit', '1000'], {
      from: 'user',
    })

    expect(apiRequest).toHaveBeenCalledWith(
      'GET',
      '/management/pending-offer-details',
    )
  })

  it('skips when no pending offers', async () => {
    vi.mocked(apiRequest).mockReset()
    vi.mocked(apiRequest).mockResolvedValueOnce({
      offers: [],
      total: 0,
    })

    await manager.parseAsync(['download', 'offer-details'], { from: 'user' })

    expect(apiRequest).toHaveBeenCalledTimes(1) // only pending-offer-details
  })
})
