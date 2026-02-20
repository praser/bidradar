import { program } from 'commander'
import { apiKey } from './commands/api-key.js'
import { login } from './commands/login.js'
import { logout } from './commands/logout.js'
import { query } from './commands/query.js'
import { whoami } from './commands/whoami.js'

declare const __CLI_VERSION__: string
const version =
  typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '0.0.0-dev'
program.name('bidradar').version(version)

program.addCommand(apiKey)
program.addCommand(login)
program.addCommand(logout)
program.addCommand(query)
program.addCommand(whoami)

program.action(() => {
  program.help()
})

program.parse()
