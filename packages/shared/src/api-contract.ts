import { z } from 'zod'
import { OfferSchema } from './offer.js'
import { AuthUserSchema } from './auth.js'

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
  uf: z.string().optional(),
  city: z.string().optional(),
  sellingType: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  includeRemoved: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).optional().default(50),
  sort: z.string().optional(),
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

// GET /users/me
export const UserMeResponseSchema = AuthUserSchema

// Error response
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
})
