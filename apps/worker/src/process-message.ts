import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  downloadCefFile,
  buildCefS3Key,
  contentTypeFromExtension,
  type DownloadMetadataRepository,
  type FileStore,
} from '@bidradar/core'
import { browserFetch } from './browser-fetch.js'
import type { Logger } from './logger.js'

const SqsMessageSchema = z
  .object({
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
    useBrowser: z.boolean().default(false),
  })

export interface ProcessMessageParams {
  readonly messageBody: string
  readonly bucketName: string
  readonly apiUrl: string
  readonly apiKey: string
  readonly fileStore: FileStore
  readonly logger: Logger
}

function createApiMetadataRepo(apiUrl: string, apiKey: string): DownloadMetadataRepository {
  return {
    async findByContentHash(hash) {
      const res = await fetch(new URL('/management/check-hash', apiUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ contentHash: hash }),
      })
      if (!res.ok) throw new Error(`check-hash failed: ${res.status}`)
      const data = (await res.json()) as { exists: boolean }
      return data.exists ? { id: 'existing' } : undefined
    },
    async insert(metadata) {
      const res = await fetch(new URL('/management/record-download', apiUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(metadata),
      })
      if (!res.ok) throw new Error(`record-download failed: ${res.status}`)
      const data = (await res.json()) as { downloadId: string }
      return data.downloadId
    },
  }
}

function latin1ToUtf8(buffer: Buffer): Buffer {
  const text = buffer.toString('latin1')
  return Buffer.from(text, 'utf-8')
}

export async function processMessage(params: ProcessMessageParams): Promise<void> {
  const { messageBody, apiUrl, apiKey, fileStore, logger } = params

  const parsed = SqsMessageSchema.parse(JSON.parse(messageBody))
  const { url, fileType, uf, offerId, useBrowser } = parsed

  logger.info('Processing message', { url, fileType, useBrowser })

  const metadataRepo = createApiMetadataRepo(apiUrl, apiKey)

  if (useBrowser) {
    const base = { url, fileType, fileStore, metadataRepo, logger }
    await processBrowserDownload({
      ...base,
      ...(uf ? { uf } : {}),
      ...(offerId ? { offerId } : {}),
    })
    return
  }

  const baseFetchBinary = async (fetchUrl: string): Promise<Buffer> => {
    const res = await fetch(fetchUrl)
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
    return Buffer.from(await res.arrayBuffer())
  }

  const fetchBinary =
    fileType === 'offer-list'
      ? async (u: string) => latin1ToUtf8(await baseFetchBinary(u))
      : baseFetchBinary

  const options: { url: string; uf?: string; offerId?: string } = { url }
  if (uf) options.uf = uf
  if (offerId) options.offerId = offerId

  const result = await downloadCefFile(fileType, { fetchBinary, fileStore, metadataRepo }, options)

  logger.info('Download complete', {
    outcome: result.outcome,
    contentHash: result.contentHash,
    fileSize: result.fileSize,
    s3Key: result.s3Key,
  })
}

async function processBrowserDownload(params: {
  url: string
  fileType: string
  uf?: string
  offerId?: string
  fileStore: FileStore
  metadataRepo: DownloadMetadataRepository
  logger: Logger
}): Promise<void> {
  const { url, fileType, uf, offerId, fileStore, metadataRepo, logger } = params

  const { html, screenshot } = await browserFetch(url)

  const htmlHash = createHash('sha256').update(html).digest('hex')
  const existing = await metadataRepo.findByContentHash(htmlHash)
  if (existing) {
    logger.info('Browser download skipped (duplicate)', { contentHash: htmlHash })
    return
  }

  // Upload HTML
  const s3KeyParams: { fileType: 'offer-details'; uf?: string; offerId?: string } = {
    fileType: 'offer-details',
  }
  if (uf) s3KeyParams.uf = uf
  if (offerId) s3KeyParams.offerId = offerId
  const htmlS3Key = buildCefS3Key(s3KeyParams)
  const htmlExt = htmlS3Key.split('.').pop()!
  const { bucketName, bucketKey } = await fileStore.store({
    key: htmlS3Key,
    content: html,
    contentType: contentTypeFromExtension(htmlExt),
  })

  const htmlFileName = htmlS3Key.split('/').pop()!
  await metadataRepo.insert({
    fileName: htmlFileName,
    fileExtension: htmlExt,
    fileSize: html.length,
    fileType: 'offer-details',
    downloadUrl: url,
    downloadedAt: new Date(),
    bucketName,
    bucketKey,
    contentHash: htmlHash,
  })

  // Upload screenshot
  const screenshotS3KeyParams: {
    fileType: 'offer-details-screenshot'
    uf?: string
    offerId?: string
  } = { fileType: 'offer-details-screenshot' }
  if (uf) screenshotS3KeyParams.uf = uf
  if (offerId) screenshotS3KeyParams.offerId = offerId
  const screenshotS3Key = buildCefS3Key(screenshotS3KeyParams)
  const screenshotExt = screenshotS3Key.split('.').pop()!
  const screenshotResult = await fileStore.store({
    key: screenshotS3Key,
    content: screenshot,
    contentType: contentTypeFromExtension(screenshotExt),
  })

  const screenshotHash = createHash('sha256').update(screenshot).digest('hex')
  const screenshotFileName = screenshotS3Key.split('/').pop()!
  await metadataRepo.insert({
    fileName: screenshotFileName,
    fileExtension: screenshotExt,
    fileSize: screenshot.length,
    fileType: 'offer-details-screenshot',
    downloadUrl: url,
    downloadedAt: new Date(),
    bucketName: screenshotResult.bucketName,
    bucketKey: screenshotResult.bucketKey,
    contentHash: screenshotHash,
  })

  logger.info('Browser download complete', {
    htmlS3Key,
    screenshotS3Key,
    fileType,
    contentHash: htmlHash,
  })
}
