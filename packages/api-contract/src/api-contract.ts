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
  sessionId: z.string().uuid(),
})

// GET /auth/token?session=X
export const AuthTokenResponseSchema = z.object({
  token: z.string(),
  user: AuthUserSchema,
})


// GET /offers
export const OffersQuerySchema = z.object({
  filter: z.string().max(2000).optional(),
  includeRemoved: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).optional().default(50),
  sort: z.string().default('updatedAt desc'),
})

export const OffersResponseSchema = z.object({
  data: z.array(OfferSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  }),
})

// POST /reconcile/:source
export const ReconcileParamsSchema = z.object({
  source: z.enum(['cef']),
})

export const ReconcileQuerySchema = z.object({
  uf: z.string().optional(),
})

export const ReconcileResponseSchema = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  removed: z.number(),
})

// Reconcile NDJSON streaming events
export const ReconcileEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), total: z.number().int() }),
  z.object({
    type: z.literal('progress'),
    step: z.string(),
    detail: z.record(z.string(), z.number()).optional(),
  }),
  z.object({
    type: z.literal('done'),
    created: z.number(),
    updated: z.number(),
    skipped: z.number(),
    removed: z.number(),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
])
export type ReconcileEvent = z.infer<typeof ReconcileEventSchema>

// GET /users/me
export const UserMeResponseSchema = AuthUserSchema

// Error response
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
})
