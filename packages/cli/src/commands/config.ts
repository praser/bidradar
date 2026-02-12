import { Command } from 'commander'
import { saveConfig, loadConfig } from '../lib/config.js'

export const config = new Command('config').description(
  'Manage CLI configuration',
)

config
  .command('set-api-url')
  .argument('<url>', 'API base URL')
  .description('Set the bidradar API URL')
  .action(async (url: string) => {
    await saveConfig({ apiUrl: url })
    console.log(`API URL set to: ${url}`)
  })

config
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    const cfg = await loadConfig()
    console.log(JSON.stringify(cfg, null, 2))
  })
