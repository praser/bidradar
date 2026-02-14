import { Hono } from 'hono'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { UploadUrlRequestSchema } from '@bidradar/api-contract'
import { buildCefS3Key } from '@bidradar/core'
import type { AuthEnv } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import type { Env } from '../env.js'

const PRESIGN_EXPIRES_IN = 300 // 5 minutes

export function managementRoutes(env: Env) {
  const app = new Hono<AuthEnv>()

  app.use('*', authorize('admin'))

  app.post('/upload-url', async (c) => {
    if (!env.BUCKET_NAME) {
      return c.json(
        {
          error: 'SERVICE_UNAVAILABLE',
          message: 'File upload is not configured',
          statusCode: 503,
        },
        503,
      )
    }

    const body = await c.req.json()
    const parsed = UploadUrlRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.message,
          statusCode: 400,
        },
        400,
      )
    }

    const { fileType } = parsed.data
    const s3Key = buildCefS3Key({ fileType, uf: 'geral' })

    const client = new S3Client({})
    const command = new PutObjectCommand({
      Bucket: env.BUCKET_NAME,
      Key: s3Key,
      ContentType: 'text/csv',
    })

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: PRESIGN_EXPIRES_IN,
    })

    return c.json({
      uploadUrl,
      s3Key,
      expiresIn: PRESIGN_EXPIRES_IN,
    })
  })

  return app
}
