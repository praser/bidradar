import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthEnv } from '../middleware/authenticate.js'

vi.mock('@bidradar/db', () => {
  const mockCurrentOffers = {
    sourceId: { name: 'sourceId' },
    uf: { name: 'uf' },
    city: { name: 'city' },
    neighborhood: { name: 'neighborhood' },
    address: { name: 'address' },
    askingPrice: { name: 'askingPrice' },
    evaluationPrice: { name: 'evaluationPrice' },
    discountPercent: { name: 'discountPercent' },
    description: { name: 'description' },
    propertyType: { name: 'propertyType' },
    sellingType: { name: 'sellingType' },
    offerUrl: { name: 'offerUrl' },
    createdAt: { name: 'createdAt' },
  }

  return {
    getDb: vi.fn(),
    currentOffers: mockCurrentOffers,
    filterToDrizzle: vi.fn().mockReturnValue('mock-sql-filter'),
    SORT_COLUMN_MAP: {
      uf: mockCurrentOffers.uf,
      city: mockCurrentOffers.city,
      neighborhood: mockCurrentOffers.neighborhood,
      address: mockCurrentOffers.address,
      description: mockCurrentOffers.description,
      propertyType: mockCurrentOffers.propertyType,
      sellingType: mockCurrentOffers.sellingType,
      askingPrice: mockCurrentOffers.askingPrice,
      evaluationPrice: mockCurrentOffers.evaluationPrice,
      discountPercent: mockCurrentOffers.discountPercent,
      createdAt: mockCurrentOffers.createdAt,
    },
  }
})

import { getDb } from '@bidradar/db'
import { offerRoutes } from './offers.js'

const sampleRow = {
  id: 'internal-1',
  sourceId: 'offer-1',
  uf: 'DF',
  city: 'Brasilia',
  neighborhood: 'Asa Sul',
  address: 'SQS 123',
  askingPrice: '100000.00',
  evaluationPrice: '150000.00',
  discountPercent: '33.33',
  description: 'Apt 3 qto(s)',
  propertyType: 'Apartamento',
  sellingType: 'Venda Direta',
  offerUrl: 'https://example.com/offer/1',
  version: 1,
  operation: 'insert',
  downloadId: null,
  createdAt: new Date('2024-01-01'),
}

function setupDbMock(rows: unknown[] = [sampleRow], count = rows.length) {
  const mockOrderBy = vi.fn().mockResolvedValue(rows)
  const mockOffset = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
  const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset })
  const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 })

  const mockWhere = vi.fn().mockResolvedValue([{ count }])
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })

  const db = {
    select: vi.fn()
      .mockReturnValueOnce({ from: mockFrom })    // count query
      .mockReturnValueOnce({ from: mockFrom2 }),   // data query
  }

  vi.mocked(getDb).mockReturnValue(db as never)
  return db
}

function createTestApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    })
    await next()
  })
  app.route('/offers', offerRoutes())
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /offers', () => {
  it('returns offers with pagination', async () => {
    setupDbMock([sampleRow], 1)
    const app = createTestApp()

    const res = await app.request('/offers')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('offer-1')
    expect(body.data[0].askingPrice).toBe(100000)
    expect(body.data[0].evaluationPrice).toBe(150000)
    expect(body.data[0].discountPercent).toBe(33.33)
    expect(body.pagination).toEqual({ page: 1, pageSize: 50, total: 1 })
  })

  it('returns 400 for invalid filter syntax', async () => {
    // No DB mock needed since filter validation happens before querying
    const app = createTestApp()

    const res = await app.request('/offers?filter=invalid%20filter%20!!!')
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('INVALID_FILTER')
  })

  it('returns 400 for invalid sort expression', async () => {
    // Setup DB mock for count query (which runs before sort validation)
    setupDbMock([], 0)
    const app = createTestApp()

    const res = await app.request('/offers?sort=invalidField%20desc')
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('INVALID_SORT')
  })

  it('returns empty data when no offers match', async () => {
    setupDbMock([], 0)
    const app = createTestApp()

    const res = await app.request('/offers')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })
})
