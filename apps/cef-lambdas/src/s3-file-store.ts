import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
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

    async get(key: string): Promise<Buffer> {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      )
      return Buffer.from(await response.Body!.transformToByteArray())
    },
  }
}
