import type { Offer } from './types.js'
import type { OfferRepository } from './offerRepository.js'

export async function reconcileOffers(
  offers: readonly Offer[],
  repo: OfferRepository,
): Promise<void> {
  const activeSourceIds = new Set(offers.map((o) => o.id))

  for (const offer of offers) {
    const existing = await repo.findBySourceId(offer.id, offer)

    if (existing === undefined) {
      await repo.insertNew(offer)
      continue
    }

    if (existing.changed) {
      await repo.updateChanged(existing.internalId, existing.version, offer)
    } else {
      await repo.touchLastSeen(existing.internalId)
    }
  }

  await repo.softDeleteMissing(activeSourceIds)
}
