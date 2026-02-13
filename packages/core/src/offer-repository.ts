import type { Offer } from './offer.js'

export interface ExistingOfferInfo {
  readonly internalId: string
  readonly version: number
  readonly changed: boolean
}

export interface OfferRepository {
  findExistingOffers(
    offers: readonly Offer[],
  ): Promise<Map<string, ExistingOfferInfo>>
  insertMany(offers: readonly Offer[]): Promise<void>
  updateMany(
    entries: readonly { internalId: string; version: number; offer: Offer }[],
  ): Promise<void>
  touchManyLastSeen(internalIds: readonly string[]): Promise<void>
  softDeleteMissing(
    uf: string,
    activeSourceIds: ReadonlySet<string>,
  ): Promise<number>
}
