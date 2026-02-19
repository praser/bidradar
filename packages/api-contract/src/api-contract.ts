import { z } from 'zod'
import { OfferSchema, AuthUserSchema, SORTABLE_FIELDS, type SortClause } from '@bidradar/core'

const SORTABLE_SET = new Set<string>(SORTABLE_FIELDS)

export function parseSort(input: string): SortClause[] {
  const clauses: SortClause[] = []

  for (const segment of input.split(',')) {
    const tokens = segment.trim().split(/\s+/)
    const field = tokens[0]
    const direction = tokens[1] ?? 'asc'

    if (!field) continue

    if (!SORTABLE_SET.has(field)) {
      throw new Error(
        `Unknown sort field '${field}'. Valid fields: ${SORTABLE_FIELDS.join(', ')}`,
      )
    }
    if (direction !== 'asc' && direction !== 'desc') {
      throw new Error(`Invalid sort direction '${direction}'. Use 'asc' or 'desc'`)
    }

    clauses.push({ field: field as SortClause['field'], direction })
  }

  if (clauses.length === 0) {
    throw new Error('Sort expression must contain at least one field')
  }

  return clauses
}

// POST /auth/session
export const AuthSessionResponseSchema = z.object({
  sessionId: z.uuid(),
})

// GET /auth/token?session=X
export const AuthTokenResponseSchema = z.object({
  token: z.string(),
  user: AuthUserSchema,
})


// GET /offers
export const OffersQuerySchema = z.object({
  filter: z.string().max(2000).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).optional().default(50),
  sort: z.string().default('createdAt desc'),
})

export const OffersResponseSchema = z.object({
  data: z.array(OfferSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  }),
})

// GET /users/me
export const UserMeResponseSchema = AuthUserSchema

// POST /management/upload-url
export const UploadUrlRequestSchema = z.object({
  fileType: z.enum([
    'offer-list',
    'auctions-schedule',
    'licensed-brokers',
    'accredited-auctioneers',
    'offer-details',
  ]),
  offerId: z.uuid().optional(),
})

export const UploadUrlResponseSchema = z.object({
  uploadUrl: z.url(),
  s3Key: z.string(),
  expiresIn: z.number(),
})

// POST /management/check-hash
export const CheckHashRequestSchema = z.object({
  contentHash: z.string().length(64),
})

export const CheckHashResponseSchema = z.object({
  exists: z.boolean(),
})

// POST /management/record-download
export const RecordDownloadRequestSchema = z.object({
  fileName: z.string(),
  fileExtension: z.string(),
  fileSize: z.number().int().positive(),
  fileType: z.string(),
  downloadUrl: z.url(),
  downloadedAt: z.coerce.date(),
  bucketName: z.string(),
  bucketKey: z.string(),
  contentHash: z.string().length(64).optional(),
})

export const RecordDownloadResponseSchema = z.object({
  downloadId: z.uuid(),
})

// GET /management/pending-offer-details
export const PendingOfferDetailsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  since: z.coerce.date().optional(),
})

export const PendingOfferDetailsResponseSchema = z.object({
  offers: z.array(
    z.object({
      id: z.uuid(),
      sourceId: z.string(),
      offerUrl: z.url(),
    }),
  ),
  total: z.number(),
})

// POST /api-keys
export const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
})

export const CreateApiKeyResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  key: z.string(),
  keyPrefix: z.string(),
  createdAt: z.string(),
})

// GET /api-keys
export const ListApiKeysResponseSchema = z.object({
  keys: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      keyPrefix: z.string(),
      createdAt: z.string(),
      lastUsedAt: z.string().nullable(),
      revokedAt: z.string().nullable(),
    }),
  ),
})

// DELETE /api-keys/:name
export const RevokeApiKeyResponseSchema = z.object({
  revoked: z.boolean(),
})

// POST /worker/heartbeat
export const WorkerHeartbeatRequestSchema = z.object({
  workerId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const WorkerHeartbeatResponseSchema = z.object({
  ok: z.boolean(),
})

// GET /worker/status
export const WorkerStatusResponseSchema = z.object({
  workers: z.array(
    z.object({
      workerId: z.string(),
      lastHeartbeatAt: z.string(),
      metadata: z.record(z.string(), z.unknown()).nullable(),
      isAlive: z.boolean(),
    }),
  ),
})

// Error response
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
})
