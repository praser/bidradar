import type { DownloadMetadataRepository } from '@bidradar/core'
import { eq } from 'drizzle-orm'
import { getDb } from './connection.js'
import { downloadMetadata } from './schema.js'

export function createDownloadMetadataRepository(): DownloadMetadataRepository {
  const db = getDb()

  return {
    async insert(metadata) {
      const values: Record<string, unknown> = {
        fileName: metadata.fileName,
        fileExtension: metadata.fileExtension,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType,
        downloadUrl: metadata.downloadUrl,
        downloadedAt: metadata.downloadedAt,
        bucketName: metadata.bucketName,
        bucketKey: metadata.bucketKey,
      }
      if (metadata.contentHash) {
        values.contentHash = metadata.contentHash
      }

      const [row] = await db
        .insert(downloadMetadata)
        .values(values as typeof downloadMetadata.$inferInsert)
        .returning({ id: downloadMetadata.id })
      return row!.id
    },

    async findByContentHash(hash) {
      const [row] = await db
        .select({ id: downloadMetadata.id })
        .from(downloadMetadata)
        .where(eq(downloadMetadata.contentHash, hash))
        .limit(1)
      return row
    },
  }
}
