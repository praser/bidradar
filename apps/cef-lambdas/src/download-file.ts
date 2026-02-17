import type { SQSEvent } from 'aws-lambda'
import { z } from 'zod'
import { downloadCefFile, type CefFileType } from '@bidradar/core'
import { createDownloadMetadataRepository } from '@bidradar/db'
import { createS3FileStore } from './s3-file-store.js'
import { createZyteFetchBinary } from './zyte-fetch.js'

const SqsMessageSchema = z.object({
  url: z.string().url(),
  fileType: z.enum([
    'offer-list',
    'auctions-schedule',
    'licensed-brokers',
    'accredited-auctioneers',
    'offer-details',
  ]),
  uf: z.string().optional(),
  offerId: z.string().optional(),
})

function latin1ToUtf8(buffer: Buffer): Buffer {
  const str = buffer.toString('latin1')
  return Buffer.from(str, 'utf-8')
}

export async function handler(event: SQSEvent) {
  const bucketName = process.env.BUCKET_NAME
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is required')
  }

  const apiKey = process.env.ZYTE_API_KEY
  if (!apiKey) {
    throw new Error('ZYTE_API_KEY environment variable is required')
  }

  const fetchBinary = createZyteFetchBinary(apiKey)
  const fileStore = createS3FileStore(bucketName)
  const metadataRepo = createDownloadMetadataRepository()

  for (const record of event.Records) {
    const parsed = SqsMessageSchema.parse(JSON.parse(record.body))

    const wrappedFetchBinary =
      parsed.fileType === 'offer-list'
        ? async (url: string) => latin1ToUtf8(await fetchBinary(url))
        : fetchBinary

    const options: { url: string; uf?: string; offerId?: string } = {
      url: parsed.url,
    }
    if (parsed.uf) {
      options.uf = parsed.uf
    }
    if (parsed.offerId) {
      options.offerId = parsed.offerId
    }

    const result = await downloadCefFile(
      parsed.fileType as CefFileType,
      { fetchBinary: wrappedFetchBinary, fileStore, metadataRepo },
      options,
    )

    console.log(
      `${parsed.fileType}: ${result.outcome} (${result.fileSize} bytes, hash ${result.contentHash.slice(0, 12)}...)`,
    )
  }
}
