import * as csv from 'csv'
import type { Offer } from './types.js'

export const imovelCaixaTransformer = ([
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
]: [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]): Offer => {
  const parsedData: Omit<Offer, 'potentialProfit'> = {
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
    offerUrl: new URL(offerUrl),
  }

  return {
    ...parsedData,
    potentialProfit: parsedData.evaluationPrice - parsedData.askingPrice,
  }
}

export const imoveisCaixaParser = (csvString: string) => {
  return csv.parse(csvString, { from_line: 5, delimiter: ';' })
}
