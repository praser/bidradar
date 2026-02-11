import type { Offer } from './types.js'

export interface ExistingOffer {
  readonly internalId: string
  readonly version: number
  readonly changed: boolean
}

export interface OfferRepository {
  findBySourceId(
    sourceId: string,
    offer: Offer,
  ): Promise<ExistingOffer | undefined>
  insertNew(offer: Offer): Promise<void>
  updateChanged(
    internalId: string,
    version: number,
    offer: Offer,
  ): Promise<void>
  touchLastSeen(internalId: string): Promise<void>
  softDeleteMissing(activeSourceIds: ReadonlySet<string>): Promise<void>
}
