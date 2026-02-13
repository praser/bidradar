import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthEnv } from '../middleware/authenticate.js'

vi.mock('@bidradar/cef', () => ({
  downloadFile: vi.fn(),
  parseOffers: vi.fn(),
}))

vi.mock('@bidradar/core', () => ({
  reconcileOffers: vi.fn(),
}))

vi.mock('@bidradar/db', () => ({
  createOfferRepository: vi.fn(() => ({})),
}))

vi.mock('@bidradar/api-contract', () => ({
  ReconcileParamsSchema: {
    parse: vi.fn((params: { source: string }) => params),
  },
  ReconcileQuerySchema: {
    parse: vi.fn((query: Record<string, string>) => query),
  },
}))

import { reconcileRoutes } from './reconcile.js'
import { downloadFile, parseOffers } from '@bidradar/cef'
import { reconcileOffers } from '@bidradar/core'

function createTestApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    })
    await next()
  })
  app.route('/reconcile', reconcileRoutes())
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /reconcile/:source', () => {
  it('streams NDJSON events for cef reconcile', async () => {
    const mockOffers = [
      { id: '1', uf: 'DF', city: 'Brasilia' },
      { id: '2', uf: 'DF', city: 'Taguatinga' },
    ]

    vi.mocked(downloadFile).mockResolvedValue('mock-stream' as never)
    vi.mocked(parseOffers).mockResolvedValue(mockOffers as never)
    vi.mocked(reconcileOffers).mockImplementation(async (_uf, _offers, _repo, onStep) => {
      if (onStep) {
        onStep({ step: 'classifying', total: 2 })
        onStep({ step: 'classified', created: 2, updated: 0, skipped: 0 })
      }
      return { created: 2, updated: 0, skipped: 0, removed: 0 }
    })

    const app = createTestApp()
    const res = await app.request('/reconcile/cef?uf=DF', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/x-ndjson')

    const text = await res.text()
    const lines = text.trim().split('\n').map((l) => JSON.parse(l))

    expect(lines[0]).toEqual({ type: 'start', total: 2 })
    // Progress events are written asynchronously, check last event
    const doneEvent = lines.find((l: { type: string }) => l.type === 'done')
    expect(doneEvent).toEqual({
      type: 'done',
      created: 2,
      updated: 0,
      skipped: 0,
      removed: 0,
    })
  })

  it('streams error event when download fails', async () => {
    vi.mocked(downloadFile).mockRejectedValue(new Error('Download failed'))

    const app = createTestApp()
    const res = await app.request('/reconcile/cef?uf=DF', { method: 'POST' })

    expect(res.status).toBe(200)

    const text = await res.text()
    const lines = text.trim().split('\n').map((l) => JSON.parse(l))
    const errorEvent = lines.find((l: { type: string }) => l.type === 'error')
    expect(errorEvent).toEqual({
      type: 'error',
      message: 'Download failed',
    })
  })
})
