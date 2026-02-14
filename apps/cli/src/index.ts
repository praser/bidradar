import { program } from 'commander'
import { login } from './commands/login.js'
import { logout } from './commands/logout.js'
import { query } from './commands/query.js'
import { whoami } from './commands/whoami.js'
import { manager } from './commands/management.js'

declare const __CLI_VERSION__: string
const version =
  typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '0.0.0-dev'
program.name('bidradar').version(version)

program.addCommand(login)
program.addCommand(logout)
program.addCommand(query)
program.addCommand(whoami)
program.addCommand(manager)

program.parse()
