import { Hono } from 'hono'
import { WorkerHeartbeatRequestSchema } from '@bidradar/api-contract'
import { createWorkerHeartbeatRepository } from '@bidradar/db'
import type { AuthEnv } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'

const ALIVE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

export function workerRoutes() {
  const app = new Hono<AuthEnv>()

  app.post('/heartbeat', authorize('admin'), async (c) => {
    const body = await c.req.json()
    const parsed = WorkerHeartbeatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.message,
          statusCode: 400,
        },
        400,
      )
    }

    const repo = createWorkerHeartbeatRepository()
    const upsertParams: Parameters<typeof repo.upsert>[0] = {
      workerId: parsed.data.workerId,
    }
    if (parsed.data.metadata) {
      upsertParams.metadata = parsed.data.metadata
    }
    await repo.upsert(upsertParams)

    return c.json({ ok: true })
  })

  app.get('/status', authorize('admin'), async (c) => {
    const repo = createWorkerHeartbeatRepository()
    const workers = await repo.findAll()
    const now = Date.now()

    return c.json({
      workers: workers.map((w) => ({
        workerId: w.workerId,
        lastHeartbeatAt: w.lastHeartbeatAt.toISOString(),
        metadata: w.metadata,
        isAlive: now - w.lastHeartbeatAt.getTime() < ALIVE_THRESHOLD_MS,
      })),
    })
  })

  return app
}
