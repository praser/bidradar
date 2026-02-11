import { Command, InvalidArgumentError } from 'commander'
import { z } from 'zod'
import { getOffers } from '../../cef/index'
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
    try {
      const offers = await getOffers(opts.uf)
      const repo = createOfferRepository()
      const result = await reconcileOffers(opts.uf, offers, repo)
      console.log(`\nReconcile CEF ${opts.uf}`)
      console.table(result)
    } finally {
      await closeDb()
    }
  })
