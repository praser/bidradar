import { getToken, getApiUrl } from './config.js'

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(
  method: string,
  path: string,
  options?: {
    body?: unknown
    query?: Record<string, string | undefined>
  },
): Promise<T> {
  const apiUrl = await getApiUrl()
  const token = await getToken()

  const url = new URL(path, apiUrl)
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const init: RequestInit = { method, headers }
  if (options?.body) {
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url, init)

  const json = (await res.json()) as Record<string, unknown>

  if (!res.ok) {
    throw new ApiError(
      res.status,
      (json.error as string) ?? 'UNKNOWN',
      (json.message as string) ?? res.statusText,
    )
  }

  return json as T
}

export async function* apiRequestStream<T>(
  method: string,
  path: string,
  options?: {
    query?: Record<string, string | undefined>
  },
): AsyncGenerator<T> {
  const apiUrl = await getApiUrl()
  const token = await getToken()

  const url = new URL(path, apiUrl)
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/x-ndjson',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { method, headers })

  if (!res.ok) {
    let errorCode = 'UNKNOWN'
    let message = res.statusText
    try {
      const json = (await res.json()) as Record<string, unknown>
      errorCode = (json.error as string) ?? errorCode
      message = (json.message as string) ?? message
    } catch {
      // response may not be JSON
    }
    throw new ApiError(res.status, errorCode, message)
  }

  if (!res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let newlineIdx: number
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim()
        buffer = buffer.slice(newlineIdx + 1)
        if (line.length > 0) {
          yield JSON.parse(line) as T
        }
      }
    }

    // Process any remaining data
    const remaining = buffer.trim()
    if (remaining.length > 0) {
      yield JSON.parse(remaining) as T
    }
  } finally {
    reader.releaseLock()
  }
}
