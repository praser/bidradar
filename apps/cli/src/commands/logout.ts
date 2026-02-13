import { Command } from 'commander'
import ora from 'ora'
import { clearToken } from '../lib/config.js'

export const logout = new Command('logout')
  .description('Log out and clear stored credentials')
  .action(async () => {
    const spinner = ora()
    try {
      spinner.start('Logging out...')
      await clearToken()
      spinner.succeed('Logged out successfully')
    } catch (err) {
      spinner.fail(
        `Logout failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
      process.exitCode = 1
    }
  })
