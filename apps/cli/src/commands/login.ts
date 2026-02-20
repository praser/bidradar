import { Command } from 'commander'
import ora from 'ora'
import open from 'open'
import type { z } from 'zod'
import type {
  AuthSessionResponseSchema,
  AuthTokenResponseSchema,
} from '@bidradar/api-contract'
import { apiRequest } from '../lib/apiClient.js'
import { saveConfig, getApiUrl } from '../lib/config.js'

type SessionResponse = z.infer<typeof AuthSessionResponseSchema>
type TokenResponse = z.infer<typeof AuthTokenResponseSchema>

type PollResponse = TokenResponse | { status: 'pending' }

async function pollForToken(
  sessionId: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<TokenResponse> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    signal.throwIfAborted()
    await new Promise((r) => setTimeout(r, 2000))

    const result = await apiRequest<PollResponse>('GET', '/auth/token', {
      query: { session: sessionId },
      signal,
    })

    if ('token' in result) {
      return result
    }
    // status: "pending" — keep polling
  }
  throw new Error('Authentication timed out after 120 seconds')
}

export const login = new Command('login')
  .description('Authenticate with Google')
  .action(async () => {
    const ac = new AbortController()
    const spinner = ora()

    const onSignal = () => {
      ac.abort()
      spinner.stop()
      process.exit(130)
    }
    process.on('SIGINT', onSignal)
    process.on('SIGTERM', onSignal)

    try {
      spinner.start('Starting login session...')
      const { sessionId } = await apiRequest<SessionResponse>(
        'POST',
        '/auth/session',
        { signal: ac.signal },
      )

      const apiUrl = await getApiUrl()
      const loginUrlObj = new URL('/auth/login', apiUrl)
      loginUrlObj.searchParams.set('session', sessionId)
      const loginUrl = loginUrlObj.href

      spinner.text = 'Opening browser for Google authentication...'
      await open(loginUrl)

      spinner.text = 'Waiting for authentication...'
      const result = await pollForToken(sessionId, 120_000, ac.signal)

      await saveConfig({ token: result.token })
      spinner.succeed(
        `Logged in as ${result.user.name} (${result.user.email}) [${result.user.role}]`,
      )
    } catch (err) {
      if (ac.signal.aborted) return

      const message = err instanceof Error ? err.message : 'Unknown error'
      const isTimeout = message.includes('timed out')

      spinner.fail(`Login failed: ${message}`)

      if (!isTimeout) {
        process.exitCode = 1
      }
    } finally {
      process.off('SIGINT', onSignal)
      process.off('SIGTERM', onSignal)
    }
  })
