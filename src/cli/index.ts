import { program } from 'commander'
import { reconcile } from './commands/reconcile'

program.name('bidradar').version('1.0.0')

program.addCommand(reconcile)

program.parse()
