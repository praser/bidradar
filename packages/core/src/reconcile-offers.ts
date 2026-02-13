import type { Offer } from './offer.js'
import type { OfferRepository, ExistingOfferInfo } from './offer-repository.js'

export interface ReconcileResult {
  readonly created: number
  readonly updated: number
  readonly skipped: number
  readonly removed: number
}

export type ReconcileStep =
  | { step: 'classifying'; total: number }
  | { step: 'classified'; created: number; updated: number; skipped: number }
  | { step: 'inserting'; count: number }
  | { step: 'updating'; count: number }
  | { step: 'touching'; count: number }
  | { step: 'removing' }

export async function reconcileOffers(
  uf: string,
  offers: readonly Offer[],
  repo: OfferRepository,
  onProgress?: (step: ReconcileStep) => void,
): Promise<ReconcileResult> {
  const activeSourceIds = new Set(offers.map((o) => o.id))

  onProgress?.({ step: 'classifying', total: offers.length })
  const existingMap = await repo.findExistingOffers(offers)

  const toInsert: Offer[] = []
  const toUpdate: { internalId: string; version: number; offer: Offer }[] = []
  const toTouch: string[] = []

  for (const offer of offers) {
    const existing: ExistingOfferInfo | undefined = existingMap.get(offer.id)

    if (existing === undefined) {
      toInsert.push(offer)
      continue
    }

    if (existing.changed) {
      toUpdate.push({
        internalId: existing.internalId,
        version: existing.version,
        offer,
      })
    } else {
      toTouch.push(existing.internalId)
    }
  }

  onProgress?.({
    step: 'classified',
    created: toInsert.length,
    updated: toUpdate.length,
    skipped: toTouch.length,
  })

  onProgress?.({ step: 'inserting', count: toInsert.length })
  if (toInsert.length > 0) {
    await repo.insertMany(toInsert)
  }

  onProgress?.({ step: 'updating', count: toUpdate.length })
  if (toUpdate.length > 0) {
    await repo.updateMany(toUpdate)
  }

  onProgress?.({ step: 'touching', count: toTouch.length })
  if (toTouch.length > 0) {
    await repo.touchManyLastSeen(toTouch)
  }

  onProgress?.({ step: 'removing' })
  const removed = await repo.softDeleteMissing(uf, activeSourceIds)

  return {
    created: toInsert.length,
    updated: toUpdate.length,
    skipped: toTouch.length,
    removed,
  }
}
