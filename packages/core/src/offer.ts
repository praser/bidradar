import { z } from 'zod'

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
  propertyType: string
  sellingType: string
  offerUrl: string
}

export const OfferSchema = z.object({
  id: z.string(),
  uf: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  address: z.string(),
  askingPrice: z.number(),
  evaluationPrice: z.number(),
  discountPercent: z.number(),
  description: z.string(),
  propertyType: z.string(),
  sellingType: z.string(),
  offerUrl: z.string().url(),
})

export type GetOffers = (uf?: string) => Promise<Offer[]>
