import { describe, it, expect } from 'vitest'
import {
  parseSort,
  OffersQuerySchema,
  AuthSessionResponseSchema,
  AuthTokenResponseSchema,
  ErrorResponseSchema,
  UploadUrlRequestSchema,
  UploadUrlResponseSchema,
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

  it('parses createdAt field', () => {
    expect(parseSort('createdAt desc')).toEqual([
      { field: 'createdAt', direction: 'desc' },
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
      page: 1,
      pageSize: 50,
      sort: 'createdAt desc',
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

describe('UploadUrlRequestSchema', () => {
  it('accepts offer-list file type', () => {
    const result = UploadUrlRequestSchema.parse({ fileType: 'offer-list' })
    expect(result.fileType).toBe('offer-list')
  })

  it('rejects unknown file type', () => {
    expect(() =>
      UploadUrlRequestSchema.parse({ fileType: 'unknown' }),
    ).toThrow()
  })
})

describe('UploadUrlResponseSchema', () => {
  it('validates upload URL response', () => {
    const result = UploadUrlResponseSchema.parse({
      uploadUrl: 'https://s3.amazonaws.com/presigned-url',
      s3Key: 'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
      expiresIn: 300,
    })
    expect(result.uploadUrl).toBe('https://s3.amazonaws.com/presigned-url')
    expect(result.s3Key).toBe(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )
    expect(result.expiresIn).toBe(300)
  })

  it('rejects invalid URL', () => {
    expect(() =>
      UploadUrlResponseSchema.parse({
        uploadUrl: 'not-a-url',
        s3Key: 'key',
        expiresIn: 300,
      }),
    ).toThrow()
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
