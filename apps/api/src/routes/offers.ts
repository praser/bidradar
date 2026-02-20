import { Hono } from 'hono'
import { OffersQuerySchema, parseSort } from '@bidradar/api-contract'
import { parseFilter, FilterParseError } from '@bidradar/core'
import { getDb, currentOffers, filterToDrizzle, SORT_COLUMN_MAP } from '@bidradar/db'
import { sql, asc, desc } from 'drizzle-orm'
import type { AuthEnv } from '../middleware/authenticate.js'

export function offerRoutes() {
  const app = new Hono<AuthEnv>()

  // GET /offers
  app.get('/', async (c) => {
    const result = OffersQuerySchema.safeParse(c.req.query())
    if (!result.success) {
      return c.json(
        { error: 'VALIDATION_ERROR', message: result.error.message, statusCode: 400 },
        400,
      )
    }
    const query = result.data
    const db = getDb()

    const conditions = []

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

    let sortClauses
    try {
      sortClauses = parseSort(query.sort)
    } catch (err) {
      return c.json(
        { error: 'INVALID_SORT', message: (err as Error).message, statusCode: 400 },
        400,
      )
    }

    const where = conditions.length > 0 ? conditions[0] : undefined

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(currentOffers)
      .where(where)
    const total = Number(countResult?.count ?? 0)

    const offset = (query.page - 1) * query.pageSize

    const orderBy = sortClauses.map((s) => {
      const col = SORT_COLUMN_MAP[s.field]
      return s.direction === 'asc' ? asc(col) : desc(col)
    })

    const rows = await db
      .select()
      .from(currentOffers)
      .where(where)
      .limit(query.pageSize)
      .offset(offset)
      .orderBy(...orderBy)

    const data = rows.map((row) => ({
      id: row.sourceId ?? '',
      uf: row.uf ?? '',
      city: row.city ?? '',
      neighborhood: row.neighborhood ?? '',
      address: row.address ?? '',
      askingPrice: Number(row.askingPrice ?? 0),
      evaluationPrice: Number(row.evaluationPrice ?? 0),
      discountPercent: Number(row.discountPercent ?? 0),
      description: row.description ?? '',
      propertyType: row.propertyType ?? '',
      sellingType: row.sellingType ?? '',
      offerUrl: row.offerUrl ?? '',
      registrationUrl: row.registrationUrl ?? '',
    }))

    return c.json({
      data,
      pagination: { page: query.page, pageSize: query.pageSize, total },
    })
  })

  return app
}
