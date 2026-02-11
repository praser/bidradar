import { downloadFile } from './utils/file-utils.js'
import type { Offer } from './offer-sourcers/OfferInterface.js'
import { parse } from 'csv'
import { CefOffer } from './offer-sourcers/CefOffer.js'

const run = async () => {
  const offers: Offer[] = []

  const stream = await downloadFile()
  const csvParser = parse({ from_line: 5, delimiter: ';' })

  stream.pipe(csvParser)

  return new Promise<Offer[]>((resolve, reject) => {
    csvParser
      .on('data', (row) => offers.push(new CefOffer(row)))
      .on('end', () => resolve(offers))
      .on('error', reject)
  })
}

run().then(console.log)
