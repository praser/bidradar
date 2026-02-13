import { execFile } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

/**
 * Base URL for the dev Lambda, set via DEV_API_URL environment variable.
 * Tests will throw if this is not set.
 */
export function getDevApiUrl(): string {
  const url = process.env['DEV_API_URL']
  if (!url) {
    throw new Error('DEV_API_URL environment variable is required for live E2E tests')
  }
  return url.replace(/\/$/, '')
}

/**
 * Make an HTTP request to the dev Lambda API.
 */
export async function liveRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const baseUrl = getDevApiUrl()
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
  const devApiUrl = getDevApiUrl()
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
