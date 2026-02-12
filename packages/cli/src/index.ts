import { program } from 'commander'
import { login } from './commands/login.js'
import { reconcile } from './commands/reconcile.js'
import { query } from './commands/query.js'
import { whoami } from './commands/whoami.js'
import { config } from './commands/config.js'

program.name('bidradar').version('0.0.1-alpha')

program.addCommand(login)
program.addCommand(reconcile)
program.addCommand(query)
program.addCommand(whoami)
program.addCommand(config)

program.parse()
