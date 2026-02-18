import { existsSync, readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { z } from 'zod'

function loadDotEnv(): void {
  const envFile = resolve(import.meta.dirname, '..', '.env.worker')
  if (!existsSync(envFile)) return

  const content = readFileSync(envFile, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex)
    const value = trimmed.slice(eqIndex + 1)
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

const EnvSchema = z.object({
  SQS_QUEUE_URL: z.string().url(),
  BUCKET_NAME: z.string(),
  BIDRADAR_API_URL: z.string().url(),
  BIDRADAR_API_KEY: z.string(),
  ZYTE_API_KEY: z.string().optional(),
  WORKER_ID: z.string().default(hostname()),
  RATE_LIMIT_DELAY_MS: z.coerce.number().default(1000),
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  AWS_REGION: z.string().default('us-east-1'),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(): Env {
  loadDotEnv()
  return EnvSchema.parse(process.env)
}
