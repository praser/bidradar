import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./config.js', () => ({
  getToken: vi.fn(),
  getApiUrl: vi.fn(),
}))

import { getToken, getApiUrl } from './config.js'
import { apiRequest, apiRequestStream, ApiError } from './apiClient.js'

const mockGetToken = vi.mocked(getToken)
const mockGetApiUrl = vi.mocked(getApiUrl)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetApiUrl.mockResolvedValue('http://localhost:3000')
  vi.stubGlobal('fetch', vi.fn())
})

describe('ApiError', () => {
  it('has statusCode, errorCode, and message', () => {
    const err = new ApiError(401, 'UNAUTHORIZED', 'Not authorized')
    expect(err.statusCode).toBe(401)
    expect(err.errorCode).toBe('UNAUTHORIZED')
    expect(err.message).toBe('Not authorized')
    expect(err.name).toBe('ApiError')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('apiRequest', () => {
  it('makes GET request with auth token', async () => {
    mockGetToken.mockResolvedValue('my-token')
    const mockResponse = { data: [1, 2, 3] }
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const result = await apiRequest('GET', '/offers')

    expect(fetch).toHaveBeenCalledWith(
      new URL('http://localhost:3000/offers'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
    expect(result).toEqual(mockResponse)
  })

  it('makes request without auth when no token', async () => {
    mockGetToken.mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )

    await apiRequest('GET', '/health')

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('appends query parameters to URL', async () => {
    mockGetToken.mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiRequest('GET', '/offers', {
      query: { filter: "uf eq 'DF'", page: '1', missing: undefined },
    })

    const url = vi.mocked(fetch).mock.calls[0]![0] as URL
    expect(url.searchParams.get('filter')).toBe("uf eq 'DF'")
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.has('missing')).toBe(false)
  })

  it('sends JSON body for POST requests', async () => {
    mockGetToken.mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: '1' }), { status: 200 }),
    )

    await apiRequest('POST', '/auth/session', {
      body: { data: 'value' },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.body).toBe(JSON.stringify({ data: 'value' }))
  })

  it('throws ApiError on non-ok response', async () => {
    mockGetToken.mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'NOT_FOUND', message: 'Resource not found' }),
        { status: 404, statusText: 'Not Found' },
      ),
    )

    try {
      await apiRequest('GET', '/missing')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.statusCode).toBe(404)
      expect(apiErr.errorCode).toBe('NOT_FOUND')
      expect(apiErr.message).toBe('Resource not found')
    }
  })
})

describe('apiRequestStream', () => {
  it('yields parsed NDJSON lines from response body', async () => {
    mockGetToken.mockResolvedValue('my-token')
    const ndjson = '{"type":"start","total":5}\n{"type":"done","created":5}\n'
    const encoder = new TextEncoder()

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(ndjson))
            controller.close()
          },
        }),
        { status: 200 },
      ),
    )

    const events: unknown[] = []
    for await (const event of apiRequestStream('POST', '/test/stream')) {
      events.push(event)
    }

    expect(events).toEqual([
      { type: 'start', total: 5 },
      { type: 'done', created: 5 },
    ])
  })

  it('throws ApiError on non-ok response', async () => {
    mockGetToken.mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Not authorized' }),
        { status: 401, statusText: 'Unauthorized' },
      ),
    )

    const gen = apiRequestStream('POST', '/test/stream')
    await expect(gen.next()).rejects.toThrow(ApiError)
  })

  it('returns immediately when response body is null', async () => {
    mockGetToken.mockResolvedValue(undefined)
    // Create a response with no body
    const response = new Response(null, { status: 200 })
    Object.defineProperty(response, 'body', { value: null })
    vi.mocked(fetch).mockResolvedValue(response)

    const events: unknown[] = []
    for await (const event of apiRequestStream('POST', '/test/stream')) {
      events.push(event)
    }

    expect(events).toEqual([])
  })

  it('sets Accept header for NDJSON', async () => {
    mockGetToken.mockResolvedValue('token')
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    const gen = apiRequestStream('POST', '/test/stream')
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    await gen.next()

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers.Accept).toBe('application/x-ndjson')
  })

  it('handles chunked NDJSON across multiple reads', async () => {
    mockGetToken.mockResolvedValue(undefined)
    const encoder = new TextEncoder()

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            // Split a line across two chunks
            controller.enqueue(encoder.encode('{"type":"sta'))
            controller.enqueue(encoder.encode('rt"}\n{"type":"done"}\n'))
            controller.close()
          },
        }),
        { status: 200 },
      ),
    )

    const events: unknown[] = []
    for await (const event of apiRequestStream('POST', '/test/stream')) {
      events.push(event)
    }

    expect(events).toEqual([
      { type: 'start' },
      { type: 'done' },
    ])
  })
})
