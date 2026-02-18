import { Command } from 'commander'
import type { AuthUser } from '@bidradar/core'
import { apiRequest, ApiError } from '../lib/apiClient.js'

export const whoami = new Command('whoami')
  .description('Show current user info')
  .action(async () => {
    try {
      const user = await apiRequest<AuthUser>('GET', '/users/me')
      console.log(`${user.name} <${user.email}> [${user.role}]`)
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        console.log(
          'Not logged in. Run `bidradar login` to authenticate.',
        )
      } else {
        console.error(
          `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
        process.exitCode = 1
      }
    }
  })
