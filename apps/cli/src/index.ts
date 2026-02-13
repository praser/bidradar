import { program } from 'commander'
import { login } from './commands/login.js'
import { logout } from './commands/logout.js'
import { reconcile } from './commands/reconcile.js'
import { query } from './commands/query.js'
import { whoami } from './commands/whoami.js'

declare const __CLI_VERSION__: string
program.name('bidradar').version(__CLI_VERSION__)

program.addCommand(login)
program.addCommand(logout)
program.addCommand(reconcile)
program.addCommand(query)
program.addCommand(whoami)

program.parse()
