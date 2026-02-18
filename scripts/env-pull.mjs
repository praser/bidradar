#!/usr/bin/env node

/**
 * Generate a .env file from SSM Parameter Store.
 *
 * Fetches all params under /bidradar/{stage}/env/ and writes them
 * to the root .env file. Useful for debugging or tools that need
 * a local .env.
 *
 * Usage:
 *   node scripts/env-pull.mjs [stage]   # default: local
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm'

const stage = process.argv[2] ?? 'local'
const prefix = `/bidradar/${stage}/env/`

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

if (params.length === 0) {
  console.error(`No parameters found under ${prefix}`)
  process.exit(1)
}

params.sort((a, b) => a.Name.localeCompare(b.Name))

const lines = params.map((p) => {
  const key = p.Name.slice(prefix.length)
  return `${key}=${p.Value}`
})

const envPath = resolve(process.cwd(), '.env')
writeFileSync(envPath, lines.join('\n') + '\n')

console.log(`Wrote ${params.length} params from ${prefix} to ${envPath}`)
