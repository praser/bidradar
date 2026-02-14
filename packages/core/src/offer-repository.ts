import type { Offer } from './offer.js'
import type { OfferForDetailDownload } from './download-offer-details.js'

export interface ExistingOfferInfo {
  readonly latestVersion: number
  readonly isActive: boolean
  readonly changed: boolean
}

export interface OfferRepository {
  findExistingOffers(
    offers: readonly Offer[],
  ): Promise<Map<string, ExistingOfferInfo>>

  insertVersions(
    entries: readonly { offer: Offer; version: number; operation: 'insert' | 'update' }[],
    downloadId: string,
  ): Promise<void>

  insertDeleteVersions(
    uf: string,
    activeSourceIds: ReadonlySet<string>,
    downloadId: string,
  ): Promise<number>

  findOffersNeedingDetails(since?: Date): Promise<OfferForDetailDownload[]>
}
