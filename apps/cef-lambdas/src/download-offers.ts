import { Readable } from 'node:stream'
import { downloadFile } from '@bidradar/cef'
import { buildCefS3Key } from '@bidradar/core'
import { createS3FileStore } from './s3-file-store.js'
import { createZyteFetch } from './zyte-fetch.js'

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return Buffer.concat(chunks)
}

export async function handler() {
  const bucketName = process.env.BUCKET_NAME
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is required')
  }

  const apiKey = process.env.ZYTE_API_KEY
  if (!apiKey) {
    throw new Error('ZYTE_API_KEY environment variable is required')
  }

  const uf = 'geral'
  const fileStore = createS3FileStore(bucketName)

  const stream = await downloadFile(uf, { fetch: createZyteFetch(apiKey) })
  const content = await streamToBuffer(stream)

  const s3Key = buildCefS3Key({ fileType: 'offer-list', uf })
  await fileStore.store({ key: s3Key, content, contentType: 'text/csv' })

  console.log(`Downloaded CEF CSV: ${content.length} bytes -> s3://${bucketName}/${s3Key}`)

  return {
    statusCode: 200,
    body: { fileSize: content.length, s3Key },
  }
}
