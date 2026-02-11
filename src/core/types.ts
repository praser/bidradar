export interface Offer {
  id: string
  uf: string
  city: string
  neighborhood: string
  address: string
  askingPrice: number
  evaluationPrice: number
  discountPercent: number
  description: string
  sellingType: string
  offerUrl: URL
}

export type GetOffers = (uf?: string) => Promise<Offer[]>
