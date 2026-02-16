import type { Offer } from './offer.js'
import type { OfferRepository } from './offer-repository.js'
import type { DownloadMetadata, DownloadMetadataRepository } from './update-cef-offers.js'
import { reconcileOffers, type ReconcileResult } from './reconcile-offers.js'

export interface ProcessOffersFileDeps {
  readonly parseOffers: (content: Buffer) => Promise<readonly Offer[]>
  readonly metadataRepo: DownloadMetadataRepository
  readonly offerRepo: OfferRepository
}

export interface ProcessOffersFileResult {
  readonly fileSize: number
  readonly totalOffers: number
  readonly states: number
  readonly results: ReadonlyMap<string, ReconcileResult>
}

export async function processOffersFile(
  content: Buffer,
  metadata: Omit<DownloadMetadata, 'fileSize'>,
  deps: ProcessOffersFileDeps,
): Promise<ProcessOffersFileResult> {
  await deps.metadataRepo.insert({
    ...metadata,
    fileSize: content.length,
  })

  const offers = await deps.parseOffers(content)

  const offersByUf = new Map<string, Offer[]>()
  for (const offer of offers) {
    const group = offersByUf.get(offer.uf)
    if (group !== undefined) {
      group.push(offer)
    } else {
      offersByUf.set(offer.uf, [offer])
    }
  }

  const results = new Map<string, ReconcileResult>()
  for (const [state, stateOffers] of offersByUf) {
    const result = await reconcileOffers(state, stateOffers, deps.offerRepo)
    results.set(state, result)
  }

  return {
    fileSize: content.length,
    totalOffers: offers.length,
    states: offersByUf.size,
    results,
  }
}
