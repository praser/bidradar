#!/usr/bin/env node

/**
 * SSM-to-env wrapper for CLI tools (drizzle-kit, etc.).
 *
 * Loads all SSM params under /bidradar/{stage}/env/ into process.env,
 * then spawns the given command. SSM values never override variables
 * already present in the environment.
 *
 * Usage:
 *   node scripts/with-ssm-env.mjs [--stage <name>] <command> [args...]
 *
 * Stage precedence: --stage flag > BIDRADAR_ENV env var > 'local'
 *
 * Examples:
 *   node scripts/with-ssm-env.mjs --stage staging printenv
 *   node scripts/with-ssm-env.mjs --stage prod pnpm --filter @bidradar/db migrate
 *   node scripts/with-ssm-env.mjs pnpm --filter @bidradar/db migrate
 */

import { spawn } from 'node:child_process'

async function loadSsmEnv(stage) {
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

  let loaded = 0
  for (const param of params) {
    const key = param.Name.slice(prefix.length)
    if (!(key in process.env)) {
      process.env[key] = param.Value
      loaded++
    }
  }

  console.error(`[with-ssm-env] stage=${stage}  ${loaded}/${params.length} params loaded (${params.length - loaded} already set)`)
}

const rawArgs = process.argv.slice(2)

let stage = process.env.BIDRADAR_ENV ?? 'local'
let commandArgs = rawArgs

if (rawArgs[0] === '--stage') {
  if (!rawArgs[1]) {
    console.error('Error: --stage requires a value')
    process.exit(1)
  }
  stage = rawArgs[1]
  commandArgs = rawArgs.slice(2)
}

if (commandArgs.length === 0) {
  console.error('Usage: node scripts/with-ssm-env.mjs [--stage <name>] <command> [args...]')
  process.exit(1)
}

await loadSsmEnv(stage)

const child = spawn(commandArgs[0], commandArgs.slice(1), {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (err) => {
  console.error(err)
  process.exit(1)
})
