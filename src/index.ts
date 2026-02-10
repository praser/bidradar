import { readLocalFile, writeLocalFile } from './file-utils.js'
import { imoveisCaixaParser, imovelCaixaTransformer } from './transformers.js'
import type { Offer } from './types.js'

const run = async (inputFilePath: string, outputFilePath: string) => {
  const data = await readLocalFile(inputFilePath)
  const parser = imoveisCaixaParser(data)
  const offers: Offer[] = []

  parser
    .on('data', (row) => {
      const offer = imovelCaixaTransformer(row)
      offers.push(offer)
    })
    .on('end', () => {
      const filteredOffers = offers
        .filter(
          (offer) =>
            offer.uf === 'DF' &&
            offer.askingPrice < 170000 &&
            offer.discountPercent > 30 &&
            ['SAMAMBAIA', 'CEILANDIA'].includes(offer.city),
        )
        .sort((a, b) => b.potentialProfit - a.potentialProfit)
      writeLocalFile(outputFilePath, JSON.stringify(filteredOffers, null, 2))
    })
}

const LOCAL_INPUT_FILE_PATH =
  '/Users/praser/Projects/imoveis-caixa/.input/Lista_imoveis_DF.csv' as const

const LOCAL_OUTPUT_FILE_PATH =
  '/Users/praser/Projects/imoveis-caixa/.output/Lista_imoveis_DF.json' as const

run(LOCAL_INPUT_FILE_PATH, LOCAL_OUTPUT_FILE_PATH)
