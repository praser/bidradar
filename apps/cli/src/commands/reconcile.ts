import { Command, InvalidArgumentError } from 'commander'
import { z } from 'zod'
import ora from 'ora'
import type { ReconcileEvent } from '@bidradar/api-contract'
import { apiRequestStream, ApiError } from '../lib/apiClient.js'

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
    'geral',
  )
  .action(async (opts: { uf: string }) => {
    const spinner = ora()
    try {
      spinner.start(
        `Downloading CEF offers${opts.uf !== 'geral' ? ` (${opts.uf})` : ''}...`,
      )

      const events = apiRequestStream<ReconcileEvent>(
        'POST',
        '/reconcile/cef',
        { query: { uf: opts.uf } },
      )

      let finalResult: { created: number; updated: number; skipped: number; removed: number } | undefined

      for await (const event of events) {
        switch (event.type) {
          case 'start':
            spinner.text = `Classifying ${event.total} offers...`
            break
          case 'progress':
            switch (event.step) {
              case 'classifying':
                spinner.text = `Classifying ${event.detail?.total ?? ''} offers...`
                break
              case 'classified':
                spinner.text = `Found: ${event.detail?.created ?? 0} new, ${event.detail?.updated ?? 0} changed, ${event.detail?.skipped ?? 0} unchanged`
                break
              case 'inserting':
                spinner.text = `Inserting ${event.detail?.count ?? 0} new offers...`
                break
              case 'updating':
                spinner.text = `Updating ${event.detail?.count ?? 0} changed offers...`
                break
              case 'touching':
                spinner.text = `Updating ${event.detail?.count ?? 0} timestamps...`
                break
              case 'removing':
                spinner.text = 'Removing stale offers...'
                break
            }
            break
          case 'done':
            finalResult = {
              created: event.created,
              updated: event.updated,
              skipped: event.skipped,
              removed: event.removed,
            }
            break
          case 'error':
            spinner.fail(`Reconciliation failed: ${event.message}`)
            process.exitCode = 1
            return
        }
      }

      if (finalResult) {
        spinner.succeed('Reconciliation complete')
        console.log()
        console.table(finalResult)
      } else {
        spinner.fail('Reconciliation ended without a result')
        process.exitCode = 1
      }
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
