import { Readable, Transform } from 'node:stream'

const createLatin1ToUtf8Stream = () =>
  new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const str = chunk.toString('latin1')
      this.push(Buffer.from(str, 'utf-8'))
      callback(null)
    },
  })

/** Downloads CSV and returns a Node Readable stream of UTF-8 bytes. */
export const downloadFile = async (
  estate: string = 'DF',
  options?: { fetch?: typeof globalThis.fetch },
) => {
  const fetchFn = options?.fetch ?? globalThis.fetch

  const res = await fetchFn(
    `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${estate}.csv`,
    {
      headers: {
        'accept-language': 'en,pt-BR;q=0.9,pt;q=0.8',
        'sec-fetch-site': 'same-site',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      },
    },
  )

  if (!res.ok || !res.body) {
    throw new Error(`Failed to download file: ${res.statusText}`)
  }

  // Type assertion: fetch's ReadableStream is compatible with Node's fromWeb at runtime
  return Readable.fromWeb(res.body as never).pipe(createLatin1ToUtf8Stream())
}
