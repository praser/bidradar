import { createHash } from 'node:crypto'
import type { FileStore, DownloadMetadataRepository } from './update-cef-offers.js'
import { buildCefS3Key, getCefFileDescriptor } from './cef-file.js'

export interface OfferForDetailDownload {
  readonly id: string
  readonly sourceId: string
  readonly offerUrl: string
}

export interface DownloadOfferDetailsDeps {
  readonly fetchBinary: (url: string) => Promise<Buffer>
  readonly fileStore: FileStore
  readonly metadataRepo: DownloadMetadataRepository
}

export interface DownloadOfferDetailsProgress {
  readonly offer: OfferForDetailDownload
  readonly outcome: 'uploaded' | 'skipped' | 'error'
  readonly index: number
  readonly total: number
  readonly error?: string
}

export interface DownloadOfferDetailsOptions {
  readonly rateLimit?: number
  readonly onProgress?: (progress: DownloadOfferDetailsProgress) => void
}

export interface DownloadOfferDetailsResult {
  readonly total: number
  readonly uploaded: number
  readonly skipped: number
  readonly errors: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function downloadOfferDetails(
  offers: readonly OfferForDetailDownload[],
  deps: DownloadOfferDetailsDeps,
  options?: DownloadOfferDetailsOptions,
): Promise<DownloadOfferDetailsResult> {
  const rateLimit = options?.rateLimit ?? 5
  const delay = 1000 / rateLimit
  const descriptor = getCefFileDescriptor('offer-details')

  let uploaded = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i]!
    let outcome: 'uploaded' | 'skipped' | 'error' = 'error'
    let errorMsg: string | undefined

    try {
      const content = await deps.fetchBinary(offer.offerUrl)
      const contentHash = createHash('sha256').update(content).digest('hex')

      const existing = await deps.metadataRepo.findByContentHash(contentHash)
      if (existing) {
        outcome = 'skipped'
        skipped++
      } else {
        const s3Key = buildCefS3Key({
          fileType: 'offer-details',
          offerId: offer.id,
        })
        const { bucketName, bucketKey } = await deps.fileStore.store({
          key: s3Key,
          content,
          contentType: descriptor.contentType,
        })

        const fileName = s3Key.split('/').pop()!
        await deps.metadataRepo.insert({
          fileName,
          fileExtension: descriptor.extension,
          fileSize: content.length,
          fileType: 'offer-details',
          downloadUrl: offer.offerUrl,
          downloadedAt: new Date(),
          bucketName,
          bucketKey,
          contentHash,
        })

        outcome = 'uploaded'
        uploaded++
      }
    } catch (err) {
      outcome = 'error'
      errorMsg = err instanceof Error ? err.message : String(err)
      errors++
    }

    const progress: DownloadOfferDetailsProgress = {
      offer,
      outcome,
      index: i,
      total: offers.length,
    }
    if (errorMsg) {
      (progress as { error: string }).error = errorMsg
    }
    options?.onProgress?.(progress)

    if (i < offers.length - 1) {
      await sleep(delay)
    }
  }

  return { total: offers.length, uploaded, skipped, errors }
}
