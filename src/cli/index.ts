import { program } from 'commander'
import { reconcile } from './commands/reconcile'
import { query } from './commands/query'

program.name('bidradar').version('0.0.1-alpha')

program.addCommand(reconcile)
program.addCommand(query)

program.parse()
