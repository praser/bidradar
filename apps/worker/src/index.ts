import { loadEnv } from './env.js'
import { createLogger } from './logger.js'
import { startHeartbeat } from './heartbeat.js'
import { startWorker } from './worker.js'

const env = await loadEnv()
const logger = createLogger(env.LOG_LEVEL)

logger.info('Starting bidradar worker', {
  workerId: env.WORKER_ID,
  queueUrl: env.SQS_QUEUE_URL,
  apiUrl: env.BIDRADAR_API_URL,
})

const heartbeat = startHeartbeat({
  apiUrl: env.BIDRADAR_API_URL,
  apiKey: env.BIDRADAR_API_KEY,
  workerId: env.WORKER_ID,
  intervalMs: 60_000,
  logger,
})

const worker = startWorker(env, logger)

let shuttingDown = false

function shutdown(signal: string): void {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('Shutting down', { signal })

  worker.stop()
  heartbeat.stop()

  // Send final heartbeat then exit
  fetch(`${env.BIDRADAR_API_URL}/worker/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.BIDRADAR_API_KEY,
    },
    body: JSON.stringify({ workerId: env.WORKER_ID, metadata: { status: 'shutdown' } }),
  })
    .catch(() => {})
    .finally(() => {
      logger.info('Worker stopped')
      process.exit(0)
    })

  // Force exit after 30 seconds if graceful shutdown stalls
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout')
    process.exit(1)
  }, 30_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
