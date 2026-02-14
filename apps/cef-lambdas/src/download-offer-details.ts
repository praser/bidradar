import { downloadOfferDetails } from '@bidradar/core'
import {
  createDownloadMetadataRepository,
  createOfferRepository,
} from '@bidradar/db'
import { createS3FileStore } from './s3-file-store.js'

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

export async function handler() {
  const bucketName = process.env.BUCKET_NAME
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is required')
  }

  const rateLimit = Number(process.env.DETAIL_DOWNLOAD_RATE_LIMIT ?? '5')

  const fileStore = createS3FileStore(bucketName)
  const metadataRepo = createDownloadMetadataRepository()
  const offerRepo = createOfferRepository()

  const offers = await offerRepo.findOffersNeedingDetails()

  console.log(`Found ${offers.length} offers needing detail downloads`)

  if (offers.length === 0) {
    return {
      statusCode: 200,
      body: { total: 0, uploaded: 0, skipped: 0, errors: 0 },
    }
  }

  const result = await downloadOfferDetails(
    offers,
    { fetchBinary, fileStore, metadataRepo },
    {
      rateLimit,
      onProgress: (progress) => {
        console.log(
          `[${progress.index + 1}/${progress.total}] Offer ${progress.offer.sourceId}: ${progress.outcome}${progress.error ? ` — ${progress.error}` : ''}`,
        )
      },
    },
  )

  console.log(
    `Completed: ${result.uploaded} uploaded, ${result.skipped} skipped, ${result.errors} errors`,
  )

  return {
    statusCode: 200,
    body: result,
  }
}
