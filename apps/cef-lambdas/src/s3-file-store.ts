import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { FileStore } from '@bidradar/core'

export function createS3FileStore(bucketName: string): FileStore {
  const client = new S3Client({})

  return {
    async store({ key, content, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: content,
          ContentType: contentType,
        }),
      )
      return { bucketName, bucketKey: key }
    },
  }
}
