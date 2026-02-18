#!/usr/bin/env node

/**
 * SSM-to-env wrapper for CLI tools (drizzle-kit, etc.).
 *
 * Loads all SSM params under /bidradar/{stage}/env/ into process.env,
 * then spawns the given command. Skips the SSM call if DATABASE_URL
 * is already present (CI / Lambda / .env case).
 *
 * Usage:
 *   node scripts/with-ssm-env.mjs pnpm --filter @bidradar/db migrate
 */

import { spawn } from 'node:child_process'

async function loadSsmEnv() {
  if (process.env.DATABASE_URL) return

  const stage = process.env.BIDRADAR_ENV ?? 'local'
  const prefix = `/bidradar/${stage}/env/`

  const { SSMClient, GetParametersByPathCommand } = await import(
    '@aws-sdk/client-ssm'
  )

  const ssm = new SSMClient()
  const params = []
  let nextToken

  do {
    const result = await ssm.send(
      new GetParametersByPathCommand({
        Path: prefix,
        WithDecryption: true,
        NextToken: nextToken,
      }),
    )
    if (result.Parameters) params.push(...result.Parameters)
    nextToken = result.NextToken
  } while (nextToken)

  for (const param of params) {
    const key = param.Name.slice(prefix.length)
    if (!(key in process.env)) {
      process.env[key] = param.Value
    }
  }
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/with-ssm-env.mjs <command> [args...]')
  process.exit(1)
}

await loadSsmEnv()

const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (err) => {
  console.error(err)
  process.exit(1)
})
