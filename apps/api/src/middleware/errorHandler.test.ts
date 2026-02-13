import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { ZodError, z } from 'zod'
import { errorHandler } from './errorHandler.js'

function createTestApp() {
  const app = new Hono()
  app.onError(errorHandler)

  app.get('/zod-error', () => {
    z.object({ name: z.string() }).parse({ name: 42 })
    return new Response('ok')
  })

  app.get('/generic-error', () => {
    throw new Error('something broke')
  })

  return app
}

describe('errorHandler', () => {
  it('returns 400 for ZodError', async () => {
    const app = createTestApp()
    const res = await app.request('/zod-error')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
    expect(body.statusCode).toBe(400)
  })

  it('returns 500 for generic errors', async () => {
    const app = createTestApp()
    const res = await app.request('/generic-error')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('INTERNAL_ERROR')
    expect(body.statusCode).toBe(500)
    expect(body.message).toBe('An unexpected error occurred')
  })
})
