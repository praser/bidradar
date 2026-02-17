import { createHash } from 'node:crypto'
import type { SQSEvent } from 'aws-lambda'
import { z } from 'zod'
import {
  downloadCefFile,
  buildCefS3Key,
  contentTypeFromExtension,
  type CefFileType,
} from '@bidradar/core'
import { createDownloadMetadataRepository } from '@bidradar/db'
import { createS3FileStore } from './s3-file-store.js'
import { createZyteFetchBinary } from './zyte-fetch.js'
import { browserFetch } from './browser-fetch.js'

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
  useZyte: z.boolean().default(false),
  useBrowser: z.boolean().default(false),
}).refine(
  (data) => !(data.useZyte && data.useBrowser),
  { message: 'useZyte and useBrowser cannot both be true' },
)

async function plainFetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

function latin1ToUtf8(buffer: Buffer): Buffer {
  const str = buffer.toString('latin1')
  return Buffer.from(str, 'utf-8')
}

type ParsedMessage = z.output<typeof SqsMessageSchema>
type FileStore = Parameters<typeof downloadCefFile>[1]['fileStore']
type MetadataRepo = Parameters<typeof downloadCefFile>[1]['metadataRepo']

async function handleStandardDownload(
  parsed: ParsedMessage,
  bucketName: string,
  fileStore: FileStore,
  metadataRepo: MetadataRepo,
) {
  let fetchBinary: (url: string) => Promise<Buffer>
  if (parsed.useZyte) {
    const apiKey = process.env.ZYTE_API_KEY
    if (!apiKey) {
      throw new Error('ZYTE_API_KEY environment variable is required')
    }
    fetchBinary = createZyteFetchBinary(apiKey)
  } else {
    fetchBinary = plainFetchBinary
  }

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
    `${parsed.fileType}: ${result.outcome} (${result.fileSize} bytes, hash ${result.contentHash.slice(0, 12)}...)` +
      (result.s3Key ? ` -> s3://${bucketName}/${result.s3Key}` : ''),
  )
}

async function handleBrowserDownload(
  parsed: ParsedMessage,
  bucketName: string,
  fileStore: FileStore,
  metadataRepo: MetadataRepo,
) {
  const { html, screenshot } = await browserFetch(parsed.url)
  const contentHash = createHash('sha256').update(html).digest('hex')

  const existing = await metadataRepo.findByContentHash(contentHash)
  if (existing) {
    console.log(
      `${parsed.fileType} (browser): skipped (${html.length} bytes, hash ${contentHash.slice(0, 12)}...)`,
    )
    return
  }

  const runId = crypto.randomUUID().slice(0, 8)
  const date = new Date().toISOString().split('T')[0]!

  const keyParams: { fileType: CefFileType; date: string; runId: string; offerId?: string } = {
    fileType: parsed.fileType as CefFileType,
    date,
    runId,
  }
  if (parsed.offerId) {
    keyParams.offerId = parsed.offerId
  }

  const htmlKey = buildCefS3Key(keyParams)
  const screenshotKey = buildCefS3Key({
    ...keyParams,
    fileType: 'offer-details-screenshot',
  })

  const htmlExt = htmlKey.split('.').pop()!
  const screenshotExt = screenshotKey.split('.').pop()!

  const [htmlResult, screenshotResult] = await Promise.all([
    fileStore.store({
      key: htmlKey,
      content: html,
      contentType: contentTypeFromExtension(htmlExt),
    }),
    fileStore.store({
      key: screenshotKey,
      content: screenshot,
      contentType: contentTypeFromExtension(screenshotExt),
    }),
  ])

  await Promise.all([
    metadataRepo.insert({
      fileName: htmlKey.split('/').pop()!,
      fileExtension: htmlExt,
      fileSize: html.length,
      fileType: parsed.fileType,
      downloadUrl: parsed.url,
      downloadedAt: new Date(),
      bucketName: htmlResult.bucketName,
      bucketKey: htmlResult.bucketKey,
      contentHash,
    }),
    metadataRepo.insert({
      fileName: screenshotKey.split('/').pop()!,
      fileExtension: screenshotExt,
      fileSize: screenshot.length,
      fileType: 'offer-details-screenshot',
      downloadUrl: parsed.url,
      downloadedAt: new Date(),
      bucketName: screenshotResult.bucketName,
      bucketKey: screenshotResult.bucketKey,
    }),
  ])

  console.log(
    `${parsed.fileType} (browser): uploaded HTML (${html.length} bytes) -> s3://${bucketName}/${htmlKey}`,
  )
  console.log(
    `${parsed.fileType} (browser): uploaded screenshot (${screenshot.length} bytes) -> s3://${bucketName}/${screenshotKey}`,
  )
}

export async function handler(event: SQSEvent) {
  const bucketName = process.env.BUCKET_NAME
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is required')
  }

  const fileStore = createS3FileStore(bucketName)
  const metadataRepo = createDownloadMetadataRepository()

  for (const record of event.Records) {
    const parsed = SqsMessageSchema.parse(JSON.parse(record.body))

    if (parsed.useBrowser) {
      await handleBrowserDownload(parsed, bucketName, fileStore, metadataRepo)
    } else {
      await handleStandardDownload(parsed, bucketName, fileStore, metadataRepo)
    }
  }
}
