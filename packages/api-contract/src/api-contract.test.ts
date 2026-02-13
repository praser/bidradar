import { describe, it, expect } from 'vitest'
import {
  parseSort,
  OffersQuerySchema,
  ReconcileParamsSchema,
  ReconcileQuerySchema,
  AuthSessionResponseSchema,
  AuthTokenResponseSchema,
  ReconcileEventSchema,
  ErrorResponseSchema,
} from './api-contract.js'

describe('parseSort', () => {
  it('parses single field ascending (default)', () => {
    expect(parseSort('askingPrice')).toEqual([
      { field: 'askingPrice', direction: 'asc' },
    ])
  })

  it('parses single field with explicit direction', () => {
    expect(parseSort('askingPrice desc')).toEqual([
      { field: 'askingPrice', direction: 'desc' },
    ])
  })

  it('parses multiple sort fields', () => {
    expect(parseSort('uf asc, askingPrice desc')).toEqual([
      { field: 'uf', direction: 'asc' },
      { field: 'askingPrice', direction: 'desc' },
    ])
  })

  it('parses updatedAt field', () => {
    expect(parseSort('updatedAt desc')).toEqual([
      { field: 'updatedAt', direction: 'desc' },
    ])
  })

  it('throws on unknown field', () => {
    expect(() => parseSort('unknownField')).toThrow('Unknown sort field')
  })

  it('throws on invalid direction', () => {
    expect(() => parseSort('askingPrice up')).toThrow('Invalid sort direction')
  })

  it('throws on empty string', () => {
    expect(() => parseSort('')).toThrow('at least one field')
  })
})

describe('OffersQuerySchema', () => {
  it('applies defaults', () => {
    const result = OffersQuerySchema.parse({})
    expect(result).toEqual({
      includeRemoved: false,
      page: 1,
      pageSize: 50,
      sort: 'updatedAt desc',
    })
  })

  it('coerces string page to number', () => {
    const result = OffersQuerySchema.parse({ page: '3' })
    expect(result.page).toBe(3)
  })

  it('coerces string pageSize to number', () => {
    const result = OffersQuerySchema.parse({ pageSize: '100' })
    expect(result.pageSize).toBe(100)
  })

  it('rejects page < 1', () => {
    expect(() => OffersQuerySchema.parse({ page: '0' })).toThrow()
  })

  it('rejects pageSize > 1000', () => {
    expect(() => OffersQuerySchema.parse({ pageSize: '1001' })).toThrow()
  })

  it('accepts filter string', () => {
    const result = OffersQuerySchema.parse({ filter: "uf eq 'SP'" })
    expect(result.filter).toBe("uf eq 'SP'")
  })

  it('rejects filter longer than 2000 chars', () => {
    expect(() => OffersQuerySchema.parse({ filter: 'x'.repeat(2001) })).toThrow()
  })
})

describe('ReconcileParamsSchema', () => {
  it('accepts cef', () => {
    expect(ReconcileParamsSchema.parse({ source: 'cef' })).toEqual({ source: 'cef' })
  })

  it('rejects unknown source', () => {
    expect(() => ReconcileParamsSchema.parse({ source: 'unknown' })).toThrow()
  })
})

describe('ReconcileQuerySchema', () => {
  it('accepts optional uf', () => {
    expect(ReconcileQuerySchema.parse({})).toEqual({})
  })

  it('accepts uf string', () => {
    expect(ReconcileQuerySchema.parse({ uf: 'SP' })).toEqual({ uf: 'SP' })
  })
})

describe('AuthSessionResponseSchema', () => {
  it('validates session response', () => {
    const result = AuthSessionResponseSchema.parse({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })
})

describe('AuthTokenResponseSchema', () => {
  it('validates token response', () => {
    const result = AuthTokenResponseSchema.parse({
      token: 'jwt-token',
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        name: 'Test User',
        role: 'free',
      },
    })
    expect(result.token).toBe('jwt-token')
    expect(result.user.role).toBe('free')
  })
})

describe('ReconcileEventSchema', () => {
  it('validates start event', () => {
    const result = ReconcileEventSchema.parse({ type: 'start', total: 100 })
    expect(result.type).toBe('start')
  })

  it('validates progress event', () => {
    const result = ReconcileEventSchema.parse({
      type: 'progress',
      step: 'classifying',
      detail: { total: 50 },
    })
    expect(result.type).toBe('progress')
  })

  it('validates done event', () => {
    const result = ReconcileEventSchema.parse({
      type: 'done',
      created: 10,
      updated: 5,
      skipped: 85,
      removed: 2,
    })
    expect(result.type).toBe('done')
  })

  it('validates error event', () => {
    const result = ReconcileEventSchema.parse({
      type: 'error',
      message: 'Download failed',
    })
    expect(result.type).toBe('error')
  })
})

describe('ErrorResponseSchema', () => {
  it('validates error response', () => {
    const result = ErrorResponseSchema.parse({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input',
      statusCode: 400,
    })
    expect(result.error).toBe('VALIDATION_ERROR')
  })
})
