import { createHash } from 'node:crypto'
import type { FileStore, DownloadMetadataRepository } from './update-cef-offers.js'
import {
  type CefFileType,
  buildCefS3Key,
  contentTypeFromExtension,
} from './cef-file.js'

export interface DownloadCefFileDeps {
  readonly fetchBinary: (url: string) => Promise<Buffer>
  readonly fileStore: FileStore
  readonly metadataRepo: DownloadMetadataRepository
}

export interface DownloadCefFileResult {
  readonly outcome: 'uploaded' | 'skipped'
  readonly contentHash: string
  readonly fileSize: number
  readonly s3Key?: string
  readonly downloadId?: string
}

export async function downloadCefFile(
  fileType: CefFileType,
  deps: DownloadCefFileDeps,
  options: { url: string; uf?: string; offerId?: string },
): Promise<DownloadCefFileResult> {
  const url = options.url

  const content = await deps.fetchBinary(url)
  const contentHash = createHash('sha256').update(content).digest('hex')

  const existing = await deps.metadataRepo.findByContentHash(contentHash)
  if (existing) {
    return {
      outcome: 'skipped',
      contentHash,
      fileSize: content.length,
    }
  }

  const s3KeyParams: Parameters<typeof buildCefS3Key>[0] = { fileType }
  if (options.uf) {
    s3KeyParams.uf = options.uf
  }
  if (options.offerId) {
    s3KeyParams.offerId = options.offerId
  }
  const s3Key = buildCefS3Key(s3KeyParams)
  const ext = s3Key.split('.').pop()!
  const { bucketName, bucketKey } = await deps.fileStore.store({
    key: s3Key,
    content,
    contentType: contentTypeFromExtension(ext),
  })

  const fileName = s3Key.split('/').pop()!
  const downloadId = await deps.metadataRepo.insert({
    fileName,
    fileExtension: ext,
    fileSize: content.length,
    fileType,
    downloadUrl: url,
    downloadedAt: new Date(),
    bucketName,
    bucketKey,
    contentHash,
  })

  return {
    outcome: 'uploaded',
    contentHash,
    fileSize: content.length,
    s3Key,
    downloadId,
  }
}
