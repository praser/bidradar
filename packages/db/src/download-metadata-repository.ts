import type { DownloadMetadataRepository } from '@bidradar/core'
import { getDb } from './connection.js'
import { downloadMetadata } from './schema.js'

export function createDownloadMetadataRepository(): DownloadMetadataRepository {
  const db = getDb()

  return {
    async insert(metadata) {
      await db.insert(downloadMetadata).values({
        fileName: metadata.fileName,
        fileExtension: metadata.fileExtension,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType,
        downloadUrl: metadata.downloadUrl,
        downloadedAt: metadata.downloadedAt,
        bucketName: metadata.bucketName,
        bucketKey: metadata.bucketKey,
      })
    },
  }
}
