import { randomUUID } from 'node:crypto'
import type { Offer } from './offer.js'
import type { OfferRepository } from './offer-repository.js'
import { reconcileOffers, type ReconcileResult } from './reconcile-offers.js'

export interface FileStore {
  store(params: {
    key: string
    content: Buffer
    contentType: string
  }): Promise<{ bucketName: string; bucketKey: string }>
}

export interface DownloadMetadata {
  readonly fileName: string
  readonly fileExtension: string
  readonly fileSize: number
  readonly fileType: string
  readonly downloadUrl: string
  readonly downloadedAt: Date
  readonly bucketName: string
  readonly bucketKey: string
}

export interface DownloadMetadataRepository {
  insert(metadata: DownloadMetadata): Promise<string>
}

export interface UpdateCefOffersDeps {
  readonly fetchOffersCsv: (
    uf: string,
  ) => Promise<{ content: Buffer; downloadUrl: string }>
  readonly parseOffers: (content: Buffer) => Promise<readonly Offer[]>
  readonly fileStore: FileStore
  readonly metadataRepo: DownloadMetadataRepository
  readonly offerRepo: OfferRepository
}

export interface UpdateCefOffersResult {
  readonly fileSize: number
  readonly totalOffers: number
  readonly states: number
  readonly results: ReadonlyMap<string, ReconcileResult>
}

export async function updateCefOffers(
  deps: UpdateCefOffersDeps,
): Promise<UpdateCefOffersResult> {
  const uf = 'geral'
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const runId = randomUUID().slice(0, 8)

  const { content, downloadUrl } = await deps.fetchOffersCsv(uf)

  const bucketKey = `cef-downloads/offer-list/${date}.${uf}.${runId}.csv`
  const { bucketName } = await deps.fileStore.store({
    key: bucketKey,
    content,
    contentType: 'text/csv',
  })

  const downloadId = await deps.metadataRepo.insert({
    fileName: `${date}.${uf}.${runId}.csv`,
    fileExtension: 'csv',
    fileSize: content.length,
    fileType: 'offer-list',
    downloadUrl,
    downloadedAt: now,
    bucketName,
    bucketKey,
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
    const result = await reconcileOffers(state, stateOffers, deps.offerRepo, downloadId)
    results.set(state, result)
  }

  return {
    fileSize: content.length,
    totalOffers: offers.length,
    states: offersByUf.size,
    results,
  }
}
