import type { Offer } from './types'

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
  softDeleteMissing(uf: string, activeSourceIds: ReadonlySet<string>): Promise<number>
}
