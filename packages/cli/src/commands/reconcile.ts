import { Command, InvalidArgumentError } from 'commander'
import { z } from 'zod'
import ora from 'ora'
import type { ReconcileResponseSchema } from '@bidradar/shared'
import { apiRequest, ApiError } from '../lib/apiClient.js'

type ReconcileResponse = z.infer<typeof ReconcileResponseSchema>

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

const ufSchema = z
  .string()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(BRAZILIAN_STATES))

function parseUf(value: string): string {
  const result = ufSchema.safeParse(value)
  if (!result.success) {
    throw new InvalidArgumentError(
      `"${value}" is not a valid Brazilian state. Valid: ${BRAZILIAN_STATES.join(', ')}`,
    )
  }
  return result.data
}

export const reconcile = new Command('reconcile').description(
  'Reconcile offers from a data source',
)

reconcile
  .command('cef')
  .description('Reconcile offers from Caixa Econômica Federal')
  .option(
    '-u, --uf <code>',
    'Brazilian state code (e.g. DF, SP, RJ)',
    parseUf,
  )
  .action(async (opts: { uf?: string }) => {
    const spinner = ora()
    try {
      spinner.start(
        `Reconciling CEF offers${opts.uf ? ` (${opts.uf})` : ''}...`,
      )

      const result = await apiRequest<ReconcileResponse>(
        'POST',
        '/reconcile/cef',
        { query: { uf: opts.uf } },
      )

      spinner.succeed('Reconciliation complete')
      console.log()
      console.table(result)
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 403) {
        spinner.fail('Access denied: this command requires admin privileges')
      } else if (err instanceof ApiError && err.statusCode === 401) {
        spinner.fail(
          'Not authenticated. Run `bidradar login` to authenticate.',
        )
      } else {
        spinner.fail(
          `Reconciliation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
      }
      process.exitCode = 1
    }
  })
