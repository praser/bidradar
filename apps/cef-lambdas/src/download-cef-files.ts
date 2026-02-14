import { downloadCefFile, type CefFileType } from '@bidradar/core'
import { createDownloadMetadataRepository } from '@bidradar/db'
import { createS3FileStore } from './s3-file-store.js'

const BULK_FILE_TYPES: CefFileType[] = [
  'auctions-schedule',
  'licensed-brokers',
  'accredited-auctioneers',
]

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

  const fileStore = createS3FileStore(bucketName)
  const metadataRepo = createDownloadMetadataRepository()
  const results: Array<{
    fileType: CefFileType
    outcome: string
    fileSize: number
  }> = []

  for (const fileType of BULK_FILE_TYPES) {
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
  }

  return {
    statusCode: 200,
    body: { results },
  }
}
