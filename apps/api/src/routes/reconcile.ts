import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { ReconcileParamsSchema, ReconcileQuerySchema } from '@bidradar/api-contract'
import { reconcileOffers, type ReconcileStep } from '@bidradar/core'
import { downloadFile, parseOffers } from '@bidradar/cef'
import { createOfferRepository } from '@bidradar/db'
import type { AuthEnv } from '../middleware/authenticate.js'

function stepToEvent(step: ReconcileStep): { type: 'progress'; step: string; detail?: Record<string, number> } {
  switch (step.step) {
    case 'classifying':
      return { type: 'progress', step: 'classifying', detail: { total: step.total } }
    case 'classified':
      return {
        type: 'progress',
        step: 'classified',
        detail: { created: step.created, updated: step.updated, skipped: step.skipped },
      }
    case 'inserting':
      return { type: 'progress', step: 'inserting', detail: { count: step.count } }
    case 'updating':
      return { type: 'progress', step: 'updating', detail: { count: step.count } }
    case 'touching':
      return { type: 'progress', step: 'touching', detail: { count: step.count } }
    case 'removing':
      return { type: 'progress', step: 'removing' }
  }
}

export function reconcileRoutes() {
  const app = new Hono<AuthEnv>()

  // POST /reconcile/:source
  app.post('/:source', async (c) => {
    const { source } = ReconcileParamsSchema.parse(c.req.param())
    const { uf } = ReconcileQuerySchema.parse(c.req.query())

    if (source === 'cef') {
      c.header('Content-Type', 'application/x-ndjson')
      return stream(c, async (s) => {
        try {
          const csvStream = await downloadFile(uf)
          const offers = await parseOffers(csvStream)
          await s.write(JSON.stringify({ type: 'start', total: offers.length }) + '\n')

          const repo = createOfferRepository()
          const result = await reconcileOffers(uf ?? 'geral', offers, repo, (step) => {
            void s.write(JSON.stringify(stepToEvent(step)) + '\n')
          })

          await s.write(JSON.stringify({ type: 'done', ...result }) + '\n')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          await s.write(JSON.stringify({ type: 'error', message }) + '\n')
        }
      })
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
