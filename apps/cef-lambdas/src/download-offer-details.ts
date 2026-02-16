import { downloadOfferDetails } from '@bidradar/core'
import {
  createDownloadMetadataRepository,
  createOfferRepository,
} from '@bidradar/db'
import { createS3FileStore } from './s3-file-store.js'
import { createZyteFetchBinary } from './zyte-fetch.js'

export async function handler() {
  const bucketName = process.env.BUCKET_NAME
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is required')
  }

  const apiKey = process.env.ZYTE_API_KEY
  if (!apiKey) {
    throw new Error('ZYTE_API_KEY environment variable is required')
  }

  const rateLimit = Number(process.env.DETAIL_DOWNLOAD_RATE_LIMIT ?? '5')

  const fetchBinary = createZyteFetchBinary(apiKey)
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
