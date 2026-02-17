import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SQSEvent } from 'aws-lambda'

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
      s3Key: 'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
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

import { handler } from './download-file.js'
import { downloadCefFile } from '@bidradar/core'
import { createZyteFetchBinary } from './zyte-fetch.js'

function makeSqsEvent(body: Record<string, unknown>): SQSEvent {
  return {
    Records: [
      {
        messageId: 'msg-1',
        receiptHandle: 'handle-1',
        body: JSON.stringify(body),
        attributes: {} as never,
        messageAttributes: {},
        md5OfBody: '',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:queue',
        awsRegion: 'us-east-1',
      },
    ],
  }
}

describe('download-file handler', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BUCKET_NAME = 'test-bucket'
    process.env.ZYTE_API_KEY = 'test-zyte-key'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.from('plain-fetch-data'), { status: 200 }),
    )
  })

  afterEach(() => {
    process.env.BUCKET_NAME = originalEnv.BUCKET_NAME
    process.env.ZYTE_API_KEY = originalEnv.ZYTE_API_KEY
    vi.restoreAllMocks()
  })

  it('uses plain fetch by default (useZyte omitted)', async () => {
    await handler(
      makeSqsEvent({
        url: 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_geral.csv',
        fileType: 'offer-list',
        uf: 'geral',
      }),
    )

    expect(downloadCefFile).toHaveBeenCalledWith(
      'offer-list',
      expect.any(Object),
      { url: 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_geral.csv', uf: 'geral' },
    )
    expect(createZyteFetchBinary).not.toHaveBeenCalled()
  })

  it('uses plain fetch when useZyte is false', async () => {
    await handler(
      makeSqsEvent({
        url: 'https://example.com/schedule.pdf',
        fileType: 'auctions-schedule',
        useZyte: false,
      }),
    )

    expect(downloadCefFile).toHaveBeenCalledWith(
      'auctions-schedule',
      expect.any(Object),
      { url: 'https://example.com/schedule.pdf' },
    )
    expect(createZyteFetchBinary).not.toHaveBeenCalled()
  })

  it('uses Zyte when useZyte is true', async () => {
    await handler(
      makeSqsEvent({
        url: 'https://example.com/schedule.pdf',
        fileType: 'auctions-schedule',
        useZyte: true,
      }),
    )

    expect(createZyteFetchBinary).toHaveBeenCalledWith('test-zyte-key')
    expect(downloadCefFile).toHaveBeenCalledWith(
      'auctions-schedule',
      expect.any(Object),
      { url: 'https://example.com/schedule.pdf' },
    )
  })

  it('processes an offer-details message with offerId', async () => {
    await handler(
      makeSqsEvent({
        url: 'https://example.com/detail.html',
        fileType: 'offer-details',
        offerId: 'offer-123',
      }),
    )

    expect(downloadCefFile).toHaveBeenCalledWith(
      'offer-details',
      expect.any(Object),
      { url: 'https://example.com/detail.html', offerId: 'offer-123' },
    )
  })

  it('applies Latin1→UTF-8 conversion for offer-list with plain fetch', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(Buffer.from('caf\xe9', 'latin1'), { status: 200 }),
    )

    await handler(
      makeSqsEvent({
        url: 'https://example.com/file.csv',
        fileType: 'offer-list',
        uf: 'geral',
      }),
    )

    const call = vi.mocked(downloadCefFile).mock.calls[0]!
    const deps = call[1]
    const result = await deps.fetchBinary('https://example.com/file.csv')
    expect(result.toString('utf-8')).toBe('café')
  })

  it('applies Latin1→UTF-8 conversion for offer-list with Zyte', async () => {
    const mockFetchBinary = vi.fn().mockResolvedValue(Buffer.from('caf\xe9', 'latin1'))
    vi.mocked(createZyteFetchBinary).mockReturnValue(mockFetchBinary)

    await handler(
      makeSqsEvent({
        url: 'https://example.com/file.csv',
        fileType: 'offer-list',
        uf: 'geral',
        useZyte: true,
      }),
    )

    const call = vi.mocked(downloadCefFile).mock.calls[0]!
    const deps = call[1]
    const result = await deps.fetchBinary('https://example.com/file.csv')
    expect(result.toString('utf-8')).toBe('café')
  })

  it('does not apply Latin1 conversion for non-offer-list types', async () => {
    const rawBuffer = Buffer.from('raw-bytes')
    const mockFetchBinary = vi.fn().mockResolvedValue(rawBuffer)
    vi.mocked(createZyteFetchBinary).mockReturnValue(mockFetchBinary)

    await handler(
      makeSqsEvent({
        url: 'https://example.com/file.pdf',
        fileType: 'auctions-schedule',
        useZyte: true,
      }),
    )

    const call = vi.mocked(downloadCefFile).mock.calls[0]!
    const deps = call[1]
    expect(deps.fetchBinary).toBe(mockFetchBinary)
  })

  it('throws if BUCKET_NAME is not set', async () => {
    delete process.env.BUCKET_NAME

    await expect(
      handler(makeSqsEvent({ url: 'https://example.com', fileType: 'offer-list' })),
    ).rejects.toThrow('BUCKET_NAME environment variable is required')
  })

  it('throws if ZYTE_API_KEY is not set when useZyte is true', async () => {
    delete process.env.ZYTE_API_KEY

    await expect(
      handler(makeSqsEvent({ url: 'https://example.com', fileType: 'offer-list', useZyte: true })),
    ).rejects.toThrow('ZYTE_API_KEY environment variable is required')
  })

  it('does not require ZYTE_API_KEY when useZyte is false', async () => {
    delete process.env.ZYTE_API_KEY

    await expect(
      handler(
        makeSqsEvent({
          url: 'https://example.com/schedule.pdf',
          fileType: 'auctions-schedule',
        }),
      ),
    ).resolves.toBeUndefined()
  })
})
