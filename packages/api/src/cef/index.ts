import type { Readable } from 'node:stream'
import { downloadFile } from './downloader.js'
import type { Offer, GetOffers } from '@bidradar/shared'
import { parse } from 'csv'
import { CefOffer } from './CefOffer.js'

export { downloadFile }

export function parseOffers(stream: Readable): Promise<Offer[]> {
  const offers: Offer[] = []
  const csvParser = parse({ from_line: 5, delimiter: ';' })

  stream.pipe(csvParser)

  return new Promise<Offer[]>((resolve, reject) => {
    csvParser
      .on('data', (row: string[]) => offers.push(new CefOffer(row)))
      .on('end', () => resolve(offers))
      .on('error', reject)
  })
}

export const getOffers: GetOffers = async (uf = 'DF') => {
  const stream = await downloadFile(uf)
  return parseOffers(stream)
}
