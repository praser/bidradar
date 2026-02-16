const ZYTE_API_URL = 'https://api.zyte.com/v1/extract'

const ANTI_BAN_PARAMS = {
  geolocation: 'BR',
  device: 'desktop',
  ipType: 'datacenter',
}

export function createZyteFetchBinary(apiKey: string): (url: string) => Promise<Buffer> {
  const auth = Buffer.from(`${apiKey}:`).toString('base64')

  return async (url: string): Promise<Buffer> => {
    const res = await fetch(ZYTE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        url,
        httpResponseBody: true,
        ...ANTI_BAN_PARAMS,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Zyte API error ${res.status}: ${body}`)
    }

    const data = (await res.json()) as { httpResponseBody: string }
    return Buffer.from(data.httpResponseBody, 'base64')
  }
}

export function createZyteFetch(apiKey: string): typeof globalThis.fetch {
  const fetchBinary = createZyteFetchBinary(apiKey)

  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const buffer = await fetchBinary(url)
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
  }
}
