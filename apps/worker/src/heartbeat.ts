import type { Logger } from './logger.js'

export interface HeartbeatParams {
  readonly apiUrl: string
  readonly apiKey: string
  readonly workerId: string
  readonly intervalMs: number
  readonly logger: Logger
}

async function sendHeartbeat(apiUrl: string, apiKey: string, workerId: string): Promise<void> {
  const res = await fetch(new URL('/worker/heartbeat', apiUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ workerId }),
  })
  if (!res.ok) {
    throw new Error(`Heartbeat failed: ${res.status} ${res.statusText}`)
  }
}

export function startHeartbeat(params: HeartbeatParams): { stop: () => void } {
  const { apiUrl, apiKey, workerId, intervalMs, logger } = params

  const timer = setInterval(() => {
    sendHeartbeat(apiUrl, apiKey, workerId).catch((err) => {
      logger.warn('Heartbeat error', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }, intervalMs)

  // Send initial heartbeat immediately
  sendHeartbeat(apiUrl, apiKey, workerId).catch((err) => {
    logger.warn('Initial heartbeat error', {
      error: err instanceof Error ? err.message : String(err),
    })
  })

  return {
    stop() {
      clearInterval(timer)
    },
  }
}
