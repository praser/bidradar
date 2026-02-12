import { Hono } from 'hono'
import { ReconcileParamsSchema, ReconcileQuerySchema } from '@bidradar/shared'
import { downloadFile, parseOffers } from '../cef/index.js'
import { createOfferRepository } from '../db/offerRepository.js'
import { reconcileOffers } from '../core/reconcileOffers.js'
import type { AuthEnv } from '../middleware/authenticate.js'

export function reconcileRoutes() {
  const app = new Hono<AuthEnv>()

  // POST /reconcile/:source
  app.post('/:source', async (c) => {
    const { source } = ReconcileParamsSchema.parse(c.req.param())
    const { uf } = ReconcileQuerySchema.parse(c.req.query())

    if (source === 'cef') {
      const stream = await downloadFile(uf)
      const offers = await parseOffers(stream)
      const repo = createOfferRepository()
      const result = await reconcileOffers(uf ?? 'geral', offers, repo)
      return c.json(result)
    }

    return c.json(
      {
        error: 'NOT_FOUND',
        message: `Unknown source: ${source}`,
        statusCode: 404,
      },
      404,
    )
  })

  return app
}
