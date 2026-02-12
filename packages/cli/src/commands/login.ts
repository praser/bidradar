import { Command } from 'commander'
import ora from 'ora'
import type { z } from 'zod'
import type { AuthResponseSchema } from '@bidradar/shared'
import { startOAuthFlow } from '../lib/oauth.js'
import { apiRequest } from '../lib/apiClient.js'
import { saveConfig, loadConfig } from '../lib/config.js'

type AuthResponse = z.infer<typeof AuthResponseSchema>

export const login = new Command('login')
  .description('Authenticate with Google')
  .option(
    '--google-client-id <id>',
    'Google OAuth client ID (or set BIDRADAR_GOOGLE_CLIENT_ID)',
  )
  .action(async (opts: { googleClientId?: string }) => {
    const spinner = ora()
    try {
      const clientId =
        opts.googleClientId ?? process.env['BIDRADAR_GOOGLE_CLIENT_ID']
      if (!clientId) {
        console.error(
          'Google Client ID required. Pass --google-client-id or set BIDRADAR_GOOGLE_CLIENT_ID',
        )
        process.exitCode = 1
        return
      }

      spinner.start('Opening browser for Google authentication...')
      const { code, redirectUri } = await startOAuthFlow(clientId)

      spinner.text = 'Exchanging token...'
      const result = await apiRequest<AuthResponse>('POST', '/auth/google', {
        body: { code, redirectUri },
      })

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
