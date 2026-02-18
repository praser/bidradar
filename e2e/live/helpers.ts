import { execFile } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'

let cachedApiUrl: string | undefined

/**
 * Base URL for the dev Lambda.
 *
 * Resolution order:
 * 1. `DEV_API_URL` environment variable (backward compat / CI override)
 * 2. SSM Parameter Store `/bidradar/{env}/api-url` (env from `BIDRADAR_ENV`, default `dev`)
 *
 * The result is cached so SSM is called at most once per test run.
 */
export async function getDevApiUrl(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl

  const envUrl = process.env['DEV_API_URL']
  if (envUrl) {
    cachedApiUrl = envUrl.replace(/\/$/, '')
    return cachedApiUrl
  }

  const env = process.env['BIDRADAR_ENV'] ?? 'staging'
  const paramName = `/bidradar/${env}/api-url`

  const ssm = new SSMClient()
  const result = await ssm.send(new GetParameterCommand({ Name: paramName }))
  const value = result.Parameter?.Value

  if (!value) {
    throw new Error(
      `Could not resolve API URL: DEV_API_URL env var is not set and SSM parameter ${paramName} has no value`,
    )
  }

  cachedApiUrl = value.replace(/\/$/, '')
  return cachedApiUrl
}

/**
 * Make an HTTP request to the dev Lambda API.
 */
export async function liveRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const baseUrl = await getDevApiUrl()
  const url = `${baseUrl}${path}`
  return fetch(url, init)
}

/**
 * Path to the built CLI binary.
 */
export function getCliBinPath(): string {
  return join(import.meta.dirname, '..', '..', 'apps', 'cli', 'dist', 'bin', 'index.js')
}

/**
 * Run the CLI binary against the dev Lambda using a temporary home directory
 * so we don't modify the user's real ~/.bidradar/config.json.
 *
 * The config file is written with apiUrl pointing to DEV_API_URL.
 */
export async function runCli(
  args: string[],
  env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const devApiUrl = await getDevApiUrl()
  const tempHome = join(tmpdir(), `bidradar-e2e-${randomUUID()}`)
  const configDir = join(tempHome, '.bidradar')
  await mkdir(configDir, { recursive: true })
  await writeFile(
    join(configDir, 'config.json'),
    JSON.stringify({ apiUrl: devApiUrl }),
  )

  return new Promise((resolve) => {
    const binPath = getCliBinPath()
    const child = execFile(
      'node',
      [binPath, ...args],
      {
        env: {
          ...process.env,
          HOME: tempHome,
          USERPROFILE: tempHome,
          ...env,
        },
        timeout: 20_000,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: error?.code ? Number(error.code) : (child.exitCode ?? 0),
        })
      },
    )
  })
}
