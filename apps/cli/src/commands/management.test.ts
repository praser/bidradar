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

    vi.mocked(apiRequest).mockResolvedValue({
      uploadUrl: 'https://s3.amazonaws.com/presigned',
      s3Key: 'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
      expiresIn: 300,
    })

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

  it('downloads, gets presigned URL, and uploads', async () => {
    await manager.parseAsync(['download', 'offer-list'], { from: 'user' })

    expect(downloadFile).toHaveBeenCalledWith('geral')
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
  })

  it('sets exit code on API 401 error', async () => {
    const MockApiError = vi.mocked(ApiError)
    vi.mocked(apiRequest).mockRejectedValue(
      new MockApiError(401, 'UNAUTHORIZED', 'Not authenticated'),
    )

    await manager.parseAsync(['download', 'offer-list'], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })

  it('sets exit code on API 403 error', async () => {
    const MockApiError = vi.mocked(ApiError)
    vi.mocked(apiRequest).mockRejectedValue(
      new MockApiError(403, 'FORBIDDEN', 'Insufficient permissions'),
    )

    await manager.parseAsync(['download', 'offer-list'], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })
})
