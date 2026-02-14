import { Hono } from 'hono'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  UploadUrlRequestSchema,
  CheckHashRequestSchema,
  RecordDownloadRequestSchema,
  PendingOfferDetailsQuerySchema,
} from '@bidradar/api-contract'
import { buildCefS3Key, getCefFileDescriptor } from '@bidradar/core'
import {
  createDownloadMetadataRepository,
  createOfferRepository,
} from '@bidradar/db'
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

    const { fileType, offerId } = parsed.data
    const descriptor = getCefFileDescriptor(fileType)

    const s3KeyParams: Parameters<typeof buildCefS3Key>[0] = { fileType }
    if (fileType === 'offer-list') {
      s3KeyParams.uf = 'geral'
    }
    if (fileType === 'offer-details' && offerId) {
      s3KeyParams.offerId = offerId
    }
    const s3Key = buildCefS3Key(s3KeyParams)

    const client = new S3Client({})
    const command = new PutObjectCommand({
      Bucket: env.BUCKET_NAME,
      Key: s3Key,
      ContentType: descriptor.contentType,
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

  app.post('/check-hash', async (c) => {
    const body = await c.req.json()
    const parsed = CheckHashRequestSchema.safeParse(body)
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

    const metadataRepo = createDownloadMetadataRepository()
    const existing = await metadataRepo.findByContentHash(parsed.data.contentHash)

    return c.json({ exists: existing !== undefined })
  })

  app.post('/record-download', async (c) => {
    const body = await c.req.json()
    const parsed = RecordDownloadRequestSchema.safeParse(body)
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

    const metadataRepo = createDownloadMetadataRepository()
    const base = {
      fileName: parsed.data.fileName,
      fileExtension: parsed.data.fileExtension,
      fileSize: parsed.data.fileSize,
      fileType: parsed.data.fileType,
      downloadUrl: parsed.data.downloadUrl,
      downloadedAt: parsed.data.downloadedAt,
      bucketName: parsed.data.bucketName,
      bucketKey: parsed.data.bucketKey,
    }
    const metadata = parsed.data.contentHash
      ? { ...base, contentHash: parsed.data.contentHash }
      : base
    const downloadId = await metadataRepo.insert(metadata)

    return c.json({ downloadId })
  })

  app.get('/pending-offer-details', async (c) => {
    const query = PendingOfferDetailsQuerySchema.safeParse(c.req.query())
    if (!query.success) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: query.error.message,
          statusCode: 400,
        },
        400,
      )
    }

    const offerRepo = createOfferRepository()
    let offers = await offerRepo.findOffersNeedingDetails(query.data.since)

    const total = offers.length
    if (query.data.limit && offers.length > query.data.limit) {
      offers = offers.slice(0, query.data.limit)
    }

    return c.json({ offers, total })
  })

  return app
}
