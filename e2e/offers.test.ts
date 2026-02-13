import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import {
  getTestApp,
  request,
  createTestToken,
  createExpiredToken,
  TEST_ADMIN,
  TEST_USER,
} from './helpers.js'
import { cleanDatabase, seedOffers, closeTestDb, verifyDatabaseConnection } from './db-setup.js'

describe('GET /offers', () => {
  const app = getTestApp()
  let adminToken: string
  let userToken: string
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await verifyDatabaseConnection()
    adminToken = await createTestToken(TEST_ADMIN)
    userToken = await createTestToken(TEST_USER)
  })

  beforeEach(async () => {
    if (!dbAvailable) return
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  describe('authentication', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const res = await request(app, '/offers')
      expect(res.status).toBe(401)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('UNAUTHORIZED')
      expect(body.message).toContain('Missing or invalid Authorization header')
    })

    it('returns 401 when Authorization header has wrong format', async () => {
      const res = await request(app, '/offers', {
        headers: { Authorization: 'Basic abc123' },
      })
      expect(res.status).toBe(401)
    })

    it('returns 401 for an expired token', async () => {
      const expired = await createExpiredToken(TEST_USER)
      const res = await request(app, '/offers', {
        headers: { Authorization: `Bearer ${expired}` },
      })
      expect(res.status).toBe(401)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('UNAUTHORIZED')
      expect(body.message).toContain('Invalid or expired token')
    })

    it('returns 401 for a malformed JWT', async () => {
      const res = await request(app, '/offers', {
        headers: { Authorization: 'Bearer not-a-valid-jwt' },
      })
      expect(res.status).toBe(401)
    })

    it('returns 401 for a JWT signed with wrong secret', async () => {
      const { SignJWT } = await import('jose')
      const wrongSecret = new TextEncoder().encode(
        'wrong-secret-that-is-at-least-32-chars!!',
      )
      const token = await new SignJWT({
        sub: 'fake',
        email: 'fake@test.com',
        name: 'Fake',
        role: 'admin',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(wrongSecret)

      const res = await request(app, '/offers', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(401)
    })
  })

  describe('querying', () => {
    it('returns empty data when no offers exist', async () => {
      if (!dbAvailable) return

      const res = await request(app, '/offers', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        data: unknown[]
        pagination: { total: number }
      }
      expect(body.data).toEqual([])
      expect(body.pagination.total).toBe(0)
    })

    it('returns seeded offers', async () => {
      if (!dbAvailable) return
      await seedOffers(3)

      const res = await request(app, '/offers', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        data: unknown[]
        pagination: { total: number; page: number; pageSize: number }
      }
      expect(body.data.length).toBe(3)
      expect(body.pagination.total).toBe(3)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.pageSize).toBe(50)
    })

    it('free users can also query offers', async () => {
      if (!dbAvailable) return
      await seedOffers(2)

      const res = await request(app, '/offers', {
        headers: { Authorization: `Bearer ${userToken}` },
      })
      expect(res.status).toBe(200)

      const body = (await res.json()) as { data: unknown[] }
      expect(body.data.length).toBe(2)
    })
  })

  describe('pagination', () => {
    it('respects page and pageSize parameters', async () => {
      if (!dbAvailable) return
      await seedOffers(5)

      const res = await request(app, '/offers?pageSize=2&page=2', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        data: unknown[]
        pagination: { page: number; pageSize: number; total: number }
      }
      expect(body.data.length).toBe(2)
      expect(body.pagination.page).toBe(2)
      expect(body.pagination.pageSize).toBe(2)
      expect(body.pagination.total).toBe(5)
    })

    it('returns empty data for out-of-range page', async () => {
      if (!dbAvailable) return
      await seedOffers(3)

      const res = await request(app, '/offers?page=100', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)

      const body = (await res.json()) as { data: unknown[] }
      expect(body.data.length).toBe(0)
    })

    it('returns 400 for invalid pageSize', async () => {
      const res = await request(app, '/offers?pageSize=0', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for pageSize exceeding max', async () => {
      const res = await request(app, '/offers?pageSize=1001', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('filtering', () => {
    it('filters by uf using eq', async () => {
      if (!dbAvailable) return
      await seedOffers(4)

      const res = await request(
        app,
        `/offers?filter=${encodeURIComponent("uf eq 'DF'")}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
      expect(res.status).toBe(200)

      const body = (await res.json()) as { data: Array<{ uf: string }> }
      expect(body.data.length).toBeGreaterThan(0)
      for (const item of body.data) {
        expect(item.uf).toBe('DF')
      }
    })

    it('filters by price range', async () => {
      if (!dbAvailable) return
      await seedOffers(5)

      const res = await request(
        app,
        `/offers?filter=${encodeURIComponent('askingPrice ge 150000')}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        data: Array<{ askingPrice: number }>
      }
      for (const item of body.data) {
        expect(item.askingPrice).toBeGreaterThanOrEqual(150000)
      }
    })

    it('filters using contains on text fields', async () => {
      if (!dbAvailable) return
      await seedOffers(3)

      const res = await request(
        app,
        `/offers?filter=${encodeURIComponent("city contains 'Bras'")}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
      expect(res.status).toBe(200)

      const body = (await res.json()) as { data: Array<{ city: string }> }
      for (const item of body.data) {
        expect(item.city.toLowerCase()).toContain('bras')
      }
    })

    it('supports compound filters with and', async () => {
      if (!dbAvailable) return
      await seedOffers(4)

      const filter = encodeURIComponent("uf eq 'DF' and askingPrice ge 100000")
      const res = await request(app, `/offers?filter=${filter}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        data: Array<{ uf: string; askingPrice: number }>
      }
      for (const item of body.data) {
        expect(item.uf).toBe('DF')
        expect(item.askingPrice).toBeGreaterThanOrEqual(100000)
      }
    })

    it('returns 400 for invalid filter syntax', async () => {
      const res = await request(app, '/offers?filter=invalid!!!filter', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(400)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('INVALID_FILTER')
    })
  })

  describe('sorting', () => {
    it('sorts by askingPrice ascending', async () => {
      if (!dbAvailable) return
      await seedOffers(3)

      const res = await request(
        app,
        `/offers?sort=${encodeURIComponent('askingPrice asc')}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        data: Array<{ askingPrice: number }>
      }
      for (let i = 1; i < body.data.length; i++) {
        expect(body.data[i]!.askingPrice).toBeGreaterThanOrEqual(
          body.data[i - 1]!.askingPrice,
        )
      }
    })

    it('sorts by askingPrice descending', async () => {
      if (!dbAvailable) return
      await seedOffers(3)

      const res = await request(
        app,
        `/offers?sort=${encodeURIComponent('askingPrice desc')}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        data: Array<{ askingPrice: number }>
      }
      for (let i = 1; i < body.data.length; i++) {
        expect(body.data[i]!.askingPrice).toBeLessThanOrEqual(
          body.data[i - 1]!.askingPrice,
        )
      }
    })

    it('returns 400 for invalid sort field', async () => {
      if (!dbAvailable) return
      const res = await request(app, '/offers?sort=nonexistentField', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(400)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('INVALID_SORT')
    })

    it('returns 400 for invalid sort direction', async () => {
      if (!dbAvailable) return
      const res = await request(
        app,
        `/offers?sort=${encodeURIComponent('askingPrice invalid')}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
      expect(res.status).toBe(400)
    })
  })

  describe('response shape', () => {
    it('returns offers with expected fields', async () => {
      if (!dbAvailable) return
      await seedOffers(1)

      const res = await request(app, '/offers', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        data: Array<Record<string, unknown>>
      }
      const offer = body.data[0]!
      expect(offer).toHaveProperty('id')
      expect(offer).toHaveProperty('uf')
      expect(offer).toHaveProperty('city')
      expect(offer).toHaveProperty('neighborhood')
      expect(offer).toHaveProperty('address')
      expect(offer).toHaveProperty('askingPrice')
      expect(offer).toHaveProperty('evaluationPrice')
      expect(offer).toHaveProperty('discountPercent')
      expect(offer).toHaveProperty('description')
      expect(offer).toHaveProperty('propertyType')
      expect(offer).toHaveProperty('sellingType')
      expect(offer).toHaveProperty('offerUrl')

      expect(typeof offer.askingPrice).toBe('number')
      expect(typeof offer.evaluationPrice).toBe('number')
      expect(typeof offer.discountPercent).toBe('number')
    })
  })
})
