const MAX_REDIRECTS = 20

const DEFAULT_HEADERS: Record<string, string> = {
  Referer: 'https://venda-imoveis.caixa.gov.br/',
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}

function parseCookies(response: Response): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';')[0]
    if (!pair) continue
    const eqIndex = pair.indexOf('=')
    if (eqIndex === -1) continue
    cookies.set(pair.slice(0, eqIndex).trim(), pair.slice(eqIndex + 1).trim())
  }
  return cookies
}

function buildCookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

export async function cefFetchBinary(url: string): Promise<Buffer> {
  const jar = new Map<string, string>()
  let currentUrl = url

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS }
    const cookie = buildCookieHeader(jar)
    if (cookie) headers['Cookie'] = cookie

    const res = await fetch(currentUrl, { redirect: 'manual', headers })

    for (const [k, v] of parseCookies(res)) jar.set(k, v)

    const status = res.status
    if (status >= 300 && status < 400) {
      const location = res.headers.get('Location')
      if (!location) throw new Error(`Redirect ${status} without Location header`)
      currentUrl = new URL(location, currentUrl).href
      continue
    }

    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
    return Buffer.from(await res.arrayBuffer())
  }

  throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`)
}
