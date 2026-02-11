import { resolve } from 'path'
import { readLocalFile } from './utils/file-utils.js'
import type { Offer } from './offer-sourcers/OfferInterface.js'
import { parse } from 'csv'
import { CefOffer } from './offer-sourcers/CefOffer.js'

const PROJECT_ROOT = '/Users/praser/Projects/imoveis-caixa' as const

const run = async (inputFile: string) => {
  const offers: Offer[] = []

  const data = await readLocalFile(inputFile)

  const csvParser = parse(data, { from_line: 5, delimiter: ';' })

  csvParser
    .on('data', (row) => offers.push(new CefOffer(row)))
    .on('end', () => offers)
}

const LOCAL_INPUT_FILE_PATH = resolve(
  PROJECT_ROOT,
  '.input/Lista_imoveis_DF.csv',
)

run(LOCAL_INPUT_FILE_PATH).then(console.log)
