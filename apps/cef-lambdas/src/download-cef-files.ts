import { downloadCefFile, type CefFileType } from '@bidradar/core'
import { createDownloadMetadataRepository } from '@bidradar/db'
import { createS3FileStore } from './s3-file-store.js'
import { createZyteFetchBinary } from './zyte-fetch.js'

const BULK_FILE_TYPES: CefFileType[] = [
  'auctions-schedule',
  'licensed-brokers',
  'accredited-auctioneers',
]

export async function handler() {
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
  const results: Array<{
    fileType: CefFileType
    outcome: string
    fileSize: number
    error?: string
  }> = []

  for (const fileType of BULK_FILE_TYPES) {
    try {
      const result = await downloadCefFile(fileType, {
        fetchBinary,
        fileStore,
        metadataRepo,
      })

      results.push({
        fileType,
        outcome: result.outcome,
        fileSize: result.fileSize,
      })

      console.log(
        `${fileType}: ${result.outcome} (${result.fileSize} bytes, hash ${result.contentHash.slice(0, 12)}...)`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ fileType, outcome: 'error', fileSize: 0, error: message })
      console.error(`${fileType}: error — ${message}`)
    }
  }

  return {
    statusCode: 200,
    body: { results },
  }
}
