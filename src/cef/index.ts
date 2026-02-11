import { downloadFile } from './dowloader'
import type { Offer, GetOffers } from '../core/types'
import { parse } from 'csv'
import { CefOffer } from './CefOffer'

export const getOffers: GetOffers = async (uf = 'DF') => {
  const offers: Offer[] = []

  const stream = await downloadFile(uf)
  const csvParser = parse({ from_line: 5, delimiter: ';' })

  stream.pipe(csvParser)

  return new Promise<Offer[]>((resolve, reject) => {
    csvParser
      .on('data', (row) => offers.push(new CefOffer(row)))
      .on('end', () => resolve(offers))
      .on('error', reject)
  })
}
