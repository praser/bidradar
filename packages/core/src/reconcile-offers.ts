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

  const toInsert: { offer: Offer; version: number; operation: 'insert' | 'update' }[] = []
  let skipped = 0

  for (const offer of offers) {
    const existing: ExistingOfferInfo | undefined = existingMap.get(offer.id)

    if (existing === undefined) {
      toInsert.push({ offer, version: 1, operation: 'insert' })
      continue
    }

    if (!existing.isActive) {
      toInsert.push({ offer, version: existing.latestVersion + 1, operation: 'insert' })
      continue
    }

    if (existing.changed) {
      toInsert.push({ offer, version: existing.latestVersion + 1, operation: 'update' })
    } else {
      skipped++
    }
  }

  const created = toInsert.filter((e) => e.operation === 'insert').length
  const updated = toInsert.filter((e) => e.operation === 'update').length

  onProgress?.({ step: 'classified', created, updated, skipped })

  onProgress?.({ step: 'inserting', count: toInsert.length })
  if (toInsert.length > 0) {
    await repo.insertVersions(toInsert)
  }

  onProgress?.({ step: 'removing' })
  const removed = await repo.insertDeleteVersions(uf, activeSourceIds)

  return { created, updated, skipped, removed }
}
