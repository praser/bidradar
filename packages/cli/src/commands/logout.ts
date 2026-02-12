import { Command } from 'commander'
import ora from 'ora'
import { saveConfig } from '../lib/config.js'

export const logout = new Command('logout')
  .description('Log out and clear stored credentials')
  .action(async () => {
    const spinner = ora()
    try {
      spinner.start('Logging out...')
      await saveConfig({ token: undefined })
      spinner.succeed('Logged out successfully')
    } catch (err) {
      spinner.fail(
        `Logout failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
      process.exitCode = 1
    }
  })
