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
): Promise<TokenResponse> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000))

    const result = await apiRequest<PollResponse>('GET', '/auth/token', {
      query: { session: sessionId },
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
    const spinner = ora()
    try {
      spinner.start('Starting login session...')
      const { sessionId } = await apiRequest<SessionResponse>(
        'POST',
        '/auth/session',
      )

      const apiUrl = await getApiUrl()
      const loginUrl = `${apiUrl}/auth/login?session=${sessionId}`

      spinner.text = 'Opening browser for Google authentication...'
      await open(loginUrl)

      spinner.text = 'Waiting for authentication...'
      const result = await pollForToken(sessionId, 120_000)

      await saveConfig({ token: result.token })
      spinner.succeed(
        `Logged in as ${result.user.name} (${result.user.email}) [${result.user.role}]`,
      )
    } catch (err) {
      spinner.fail(
        `Login failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
      process.exitCode = 1
    }
  })
