import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { S3Event } from 'aws-lambda'

vi.mock('@bidradar/cef', () => ({
  parseOffers: vi.fn().mockResolvedValue([]),
}))

vi.mock('@bidradar/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bidradar/core')>()
  return {
    ...actual,
    processOffersFile: vi.fn().mockResolvedValue({
      fileSize: 100,
      totalOffers: 5,
      states: 2,
      results: new Map(),
    }),
  }
})

vi.mock('@bidradar/db', () => ({
  createOfferRepository: vi.fn().mockReturnValue({}),
}))

vi.mock('./s3-file-store.js', () => ({
  createS3FileStore: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(Buffer.from('csv-content')),
  }),
}))

import { handler } from './process-offers.js'
import { processOffersFile } from '@bidradar/core'
import { createS3FileStore } from './s3-file-store.js'

function makeS3Event(key: string): S3Event {
  return {
    Records: [
      {
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'us-east-1',
        eventTime: '2026-02-14T10:00:00.000Z',
        eventName: 'ObjectCreated:Put',
        userIdentity: { principalId: 'test' },
        requestParameters: { sourceIPAddress: '127.0.0.1' },
        responseElements: {
          'x-amz-request-id': 'test',
          'x-amz-id-2': 'test',
        },
        s3: {
          s3SchemaVersion: '1.0',
          configurationId: 'test',
          bucket: {
            name: 'test-bucket',
            ownerIdentity: { principalId: 'test' },
            arn: 'arn:aws:s3:::test-bucket',
          },
          object: {
            key,
            size: 100,
            eTag: 'test',
            sequencer: 'test',
          },
        },
      },
    ],
  }
}

describe('process-offers handler', () => {
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

  it('reads file from S3 and processes it', async () => {
    const event = makeS3Event(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )

    await handler(event)

    expect(createS3FileStore).toHaveBeenCalledWith('test-bucket')
    const fileStore = vi.mocked(createS3FileStore).mock.results[0]!.value
    expect(fileStore.get).toHaveBeenCalledWith(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )
    expect(processOffersFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        parseOffers: expect.any(Function),
        offerRepo: expect.any(Object),
      }),
    )
  })

  it('throws if BUCKET_NAME is not set', async () => {
    delete process.env.BUCKET_NAME
    const event = makeS3Event(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )

    await expect(handler(event)).rejects.toThrow(
      'BUCKET_NAME environment variable is required',
    )
  })

  it('URL-decodes S3 key', async () => {
    const event = makeS3Event(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )
    // Simulate URL-encoded key with + for spaces
    event.Records[0]!.s3.object.key =
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv'

    await handler(event)

    const fileStore = vi.mocked(createS3FileStore).mock.results[0]!.value
    expect(fileStore.get).toHaveBeenCalledWith(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )
  })
})
