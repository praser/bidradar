import { Hono } from 'hono'
import { OffersQuerySchema } from '@bidradar/shared'
import { getDb } from '../db/index.js'
import { offers } from '../db/schema.js'
import { eq, and, gte, lte, isNull, sql, asc, desc } from 'drizzle-orm'
import type { AuthEnv } from '../middleware/authenticate.js'

export function offerRoutes() {
  const app = new Hono<AuthEnv>()

  // GET /offers
  app.get('/', async (c) => {
    const query = OffersQuerySchema.parse(c.req.query())
    const db = getDb()

    const conditions = []
    if (!query.includeRemoved) conditions.push(isNull(offers.removedAt))
    if (query.uf) conditions.push(eq(offers.uf, query.uf.toUpperCase()))
    if (query.city) conditions.push(eq(offers.city, query.city))
    if (query.sellingType)
      conditions.push(eq(offers.sellingType, query.sellingType))
    if (query.minPrice !== undefined)
      conditions.push(gte(offers.askingPrice, String(query.minPrice)))
    if (query.maxPrice !== undefined)
      conditions.push(lte(offers.askingPrice, String(query.maxPrice)))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(offers)
      .where(where)
    const total = Number(countResult?.count ?? 0)

    const offset = (query.page - 1) * query.pageSize

    const rows = await db
      .select()
      .from(offers)
      .where(where)
      .limit(query.pageSize)
      .offset(offset)
      .orderBy(
        query.sort === 'price_asc'
          ? asc(offers.askingPrice)
          : desc(offers.updatedAt),
      )

    const data = rows.map((row) => ({
      id: row.sourceId,
      uf: row.uf,
      city: row.city,
      neighborhood: row.neighborhood,
      address: row.address,
      askingPrice: Number(row.askingPrice),
      evaluationPrice: Number(row.evaluationPrice),
      discountPercent: Number(row.discountPercent),
      description: row.description,
      sellingType: row.sellingType,
      offerUrl: row.offerUrl,
    }))

    return c.json({
      data,
      pagination: { page: query.page, pageSize: query.pageSize, total },
    })
  })

  return app
}
