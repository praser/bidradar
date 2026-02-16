import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createZyteFetchBinary, createZyteFetch } from './zyte-fetch.js'

describe('createZyteFetchBinary', () => {
  const apiKey = 'test-api-key'
  const expectedAuth = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to Zyte API with correct auth and body', async () => {
    const body = Buffer.from('hello world')
    const mockResponse = new Response(
      JSON.stringify({ httpResponseBody: body.toString('base64') }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const fetchBinary = createZyteFetchBinary(apiKey)
    await fetchBinary('https://example.com/file.csv')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.zyte.com/v1/extract',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: expectedAuth,
        },
        body: expect.stringContaining('"httpResponseBody":true'),
      },
    )

    const sentBody = JSON.parse(
      vi.mocked(globalThis.fetch).mock.calls[0]![1]!.body as string,
    )
    expect(sentBody).toMatchObject({
      url: 'https://example.com/file.csv',
      httpResponseBody: true,
      geolocation: 'BR',
      device: 'desktop',
      ipType: 'datacenter',
    })
  })

  it('decodes base64 httpResponseBody to Buffer', async () => {
    const original = Buffer.from('binary content here')
    const mockResponse = new Response(
      JSON.stringify({ httpResponseBody: original.toString('base64') }),
      { status: 200 },
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const fetchBinary = createZyteFetchBinary(apiKey)
    const result = await fetchBinary('https://example.com/file.pdf')

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result).toEqual(original)
  })

  it('throws on non-2xx response', async () => {
    const mockResponse = new Response('rate limit exceeded', { status: 429 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const fetchBinary = createZyteFetchBinary(apiKey)

    await expect(fetchBinary('https://example.com/file.csv')).rejects.toThrow(
      'Zyte API error 429: rate limit exceeded',
    )
  })
})

describe('createZyteFetch', () => {
  const apiKey = 'test-api-key'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a fetch-compatible Response with body', async () => {
    const content = Buffer.from('csv data')
    const mockResponse = new Response(
      JSON.stringify({ httpResponseBody: content.toString('base64') }),
      { status: 200 },
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const fetchFn = createZyteFetch(apiKey)
    const res = await fetchFn('https://example.com/data.csv')

    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(200)

    const body = Buffer.from(await res.arrayBuffer())
    expect(body).toEqual(content)
  })
})
