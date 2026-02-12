import { Hono } from 'hono'
import { OffersQuerySchema, parseFilter, parseSort, FilterParseError } from '@bidradar/shared'
import { getDb } from '../db/index.js'
import { offers } from '../db/schema.js'
import { and, isNull, sql, asc, desc } from 'drizzle-orm'
import type { AuthEnv } from '../middleware/authenticate.js'
import { filterToDrizzle, SORT_COLUMN_MAP } from '../core/filterToDrizzle.js'

export function offerRoutes() {
  const app = new Hono<AuthEnv>()

  // GET /offers
  app.get('/', async (c) => {
    const query = OffersQuerySchema.parse(c.req.query())
    const db = getDb()

    const conditions = []
    if (!query.includeRemoved) conditions.push(isNull(offers.removedAt))

    if (query.filter) {
      let ast
      try {
        ast = parseFilter(query.filter)
      } catch (err) {
        if (err instanceof FilterParseError) {
          return c.json(
            { error: 'INVALID_FILTER', message: err.message, statusCode: 400 },
            400,
          )
        }
        throw err
      }
      conditions.push(filterToDrizzle(ast))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(offers)
      .where(where)
    const total = Number(countResult?.count ?? 0)

    const offset = (query.page - 1) * query.pageSize

    let sortClauses
    try {
      sortClauses = parseSort(query.sort)
    } catch (err) {
      return c.json(
        { error: 'INVALID_SORT', message: (err as Error).message, statusCode: 400 },
        400,
      )
    }
    const orderBy = sortClauses.map((s) => {
      const col = SORT_COLUMN_MAP[s.field]
      return s.direction === 'asc' ? asc(col) : desc(col)
    })

    const rows = await db
      .select()
      .from(offers)
      .where(where)
      .limit(query.pageSize)
      .offset(offset)
      .orderBy(...orderBy)

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
