import { program } from 'commander'
import { reconcile } from './commands/reconcile'
import { query } from './commands/query'

program.name('bidradar').version('1.0.0')

program.addCommand(reconcile)
program.addCommand(query)

program.parse()
