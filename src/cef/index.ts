import { downloadFile } from './dowloader.js'
import type { Offer, GetOffers } from '../core/types.js'
import { parse } from 'csv'
import { CefOffer } from './CefOffer.js'

export const getOffers: GetOffers = async () => {
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
