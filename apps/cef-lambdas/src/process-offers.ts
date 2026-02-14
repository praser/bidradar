import { Readable } from 'node:stream'
import type { S3Event } from 'aws-lambda'
import { parseOffers } from '@bidradar/cef'
import { parseCefS3Key, buildCefDownloadUrl, processOffersFile } from '@bidradar/core'
import {
  createOfferRepository,
  createDownloadMetadataRepository,
} from '@bidradar/db'
import { createS3FileStore } from './s3-file-store.js'

export async function handler(event: S3Event) {
  const bucketName = process.env.BUCKET_NAME
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is required')
  }

  const fileStore = createS3FileStore(bucketName)

  for (const record of event.Records) {
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))
    const { fileType, uf, fileName } = parseCefS3Key(s3Key)

    const content = await fileStore.get(s3Key)
    const downloadUrl = buildCefDownloadUrl(fileType, uf)

    const result = await processOffersFile(
      content,
      {
        fileName,
        fileExtension: 'csv',
        fileType,
        downloadUrl,
        downloadedAt: new Date(record.eventTime),
        bucketName: record.s3.bucket.name,
        bucketKey: s3Key,
      },
      {
        parseOffers: async (buf) => parseOffers(Readable.from(buf)),
        metadataRepo: createDownloadMetadataRepository(),
        offerRepo: createOfferRepository(),
      },
    )

    console.log(
      `Processed ${s3Key}: ${result.totalOffers} offers across ${result.states} states (${result.fileSize} bytes)`,
    )
    for (const [state, r] of result.results) {
      console.log(
        `  ${state}: +${r.created} ~${r.updated} =${r.skipped} -${r.removed}`,
      )
    }
  }
}
