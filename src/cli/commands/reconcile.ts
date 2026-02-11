import { Command, InvalidArgumentError } from 'commander'
import { z } from 'zod'
import ora from 'ora'
import { downloadFile, parseOffers } from '../../cef/index'
import { closeDb } from '../../db/index'
import { createOfferRepository } from '../../db/offerRepository'
import { reconcileOffers } from '../../core/reconcileOffers'

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
  .option('-u, --uf <code>', 'Brazilian state code (e.g. DF, SP, RJ)', parseUf, 'geral')
  .action(async (opts: { uf: string }) => {
    const spinner = ora()
    try {
      spinner.start(`Downloading offers from CEF (${opts.uf})...`)
      const stream = await downloadFile(opts.uf)

      spinner.text = `Parsing offers...`
      const offers = await parseOffers(stream)
      spinner.succeed(`Parsed ${offers.length} offers from CEF (${opts.uf})`)

      spinner.start('Saving to database...')
      const repo = createOfferRepository()
      const result = await reconcileOffers(opts.uf, offers, repo)
      spinner.succeed('Reconciliation complete')

      console.log()
      console.table(result)
    } catch (err) {
      spinner.fail('Reconciliation failed')
      throw err
    } finally {
      await closeDb()
    }
  })
