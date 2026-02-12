import type { Offer } from './offer.js'
import type { OfferRepository } from './offer-repository.js'

export interface ReconcileResult {
  readonly created: number
  readonly updated: number
  readonly skipped: number
  readonly removed: number
}

export async function reconcileOffers(
  uf: string,
  offers: readonly Offer[],
  repo: OfferRepository,
): Promise<ReconcileResult> {
  const activeSourceIds = new Set(offers.map((o) => o.id))
  let created = 0
  let updated = 0
  let skipped = 0

  for (const offer of offers) {
    const existing = await repo.findBySourceId(offer.id, offer)

    if (existing === undefined) {
      await repo.insertNew(offer)
      created++
      continue
    }

    if (existing.changed) {
      await repo.updateChanged(existing.internalId, existing.version, offer)
      updated++
    } else {
      await repo.touchLastSeen(existing.internalId)
      skipped++
    }
  }

  const removed = await repo.softDeleteMissing(uf, activeSourceIds)

  return { created, updated, skipped, removed }
}
