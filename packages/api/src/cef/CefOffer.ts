import type { Offer } from '@bidradar/shared'
import { z } from 'zod'

const schema = z
  .tuple([
    z.string(), // id
    z.string(), // uf
    z.string(), // city
    z.string(), // neighborhood
    z.string(), // address
    z.string(), // askingPrice
    z.string(), // evaluationPrice
    z.string(), // discountPercent
    z.string(), // description
    z.string(), // sellingType
    z.string(), // offerUrl
  ])
  .transform(
    ([
      id,
      uf,
      city,
      neighborhood,
      address,
      askingPrice,
      evaluationPrice,
      discountPercent,
      description,
      sellingType,
      offerUrl,
    ]) => ({
      id: id.trim(),
      uf: uf.trim().toUpperCase(),
      city: city.trim(),
      neighborhood: neighborhood.trim(),
      address: address.trim(),
      askingPrice: Number(askingPrice.replaceAll('.', '').replace(',', '.')),
      evaluationPrice: Number(
        evaluationPrice.replaceAll('.', '').replace(',', '.'),
      ),
      discountPercent: Number(discountPercent),
      description: description.trim(),
      sellingType: sellingType.trim(),
      offerUrl: new URL(offerUrl).toString(),
    }),
  )

export class CefOffer implements Offer {
  readonly id: string
  readonly uf: string
  readonly city: string
  readonly neighborhood: string
  readonly address: string
  readonly askingPrice: number
  readonly evaluationPrice: number
  readonly discountPercent: number
  readonly description: string
  readonly sellingType: string
  readonly offerUrl: string

  constructor(input: Array<string>) {
    const parsed = schema.parse(input)
    this.id = parsed.id
    this.uf = parsed.uf
    this.city = parsed.city
    this.neighborhood = parsed.neighborhood
    this.address = parsed.address
    this.askingPrice = parsed.askingPrice
    this.evaluationPrice = parsed.evaluationPrice
    this.discountPercent = parsed.discountPercent
    this.description = parsed.description
    this.sellingType = parsed.sellingType
    this.offerUrl = parsed.offerUrl
  }
}
