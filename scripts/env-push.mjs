#!/usr/bin/env node

/**
 * Populate SSM Parameter Store from local .env file.
 *
 * Reads the root .env, pushes each key-value pair to SSM under
 * /bidradar/{stage}/env/{VAR_NAME}. Known secrets are stored as
 * SecureString, the rest as String.
 *
 * Usage:
 *   node scripts/env-push.mjs [stage]   # default: local
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm'

const SECURE_KEYS = new Set([
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'BIDRADAR_API_KEY',
])

const stage = process.argv[2] ?? 'local'
const envPath = resolve(process.cwd(), '.env')

let content
try {
  content = readFileSync(envPath, 'utf-8')
} catch {
  console.error(`Could not read ${envPath}`)
  process.exit(1)
}

const entries = []
for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIndex = trimmed.indexOf('=')
  if (eqIndex === -1) continue
  const key = trimmed.slice(0, eqIndex).trim()
  const value = trimmed.slice(eqIndex + 1).trim()
  entries.push({ key, value })
}

if (entries.length === 0) {
  console.error('No entries found in .env')
  process.exit(1)
}

const ssm = new SSMClient()
const prefix = `/bidradar/${stage}/env`

console.log(`Pushing ${entries.length} params to SSM under ${prefix}/`)

for (const { key, value } of entries) {
  const type = SECURE_KEYS.has(key) ? 'SecureString' : 'String'
  const name = `${prefix}/${key}`

  await ssm.send(
    new PutParameterCommand({
      Name: name,
      Value: value,
      Type: type,
      Overwrite: true,
    }),
  )

  console.log(`  ${name} (${type})`)
}

console.log('Done.')
