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
