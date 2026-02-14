import { describe, it, expect, vi } from 'vitest'
import { reconcileOffers, type ReconcileStep } from './reconcile-offers.js'
import type { Offer } from './offer.js'
import type { OfferRepository } from './offer-repository.js'

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    uf: 'DF',
    city: 'Brasilia',
    neighborhood: 'Asa Sul',
    address: 'SQS 101',
    askingPrice: 100000,
    evaluationPrice: 120000,
    discountPercent: 16.67,
    description: 'Apartamento, 80.00 de área total',
    propertyType: 'Apartamento',
    sellingType: 'Venda Direta',
    offerUrl: 'https://example.com/offer-1',
    ...overrides,
  }
}

function createMockRepo(
  existingMap: Map<string, { latestVersion: number; isActive: boolean; changed: boolean }> = new Map(),
): OfferRepository {
  return {
    findExistingOffers: vi.fn().mockResolvedValue(existingMap),
    insertVersions: vi.fn().mockResolvedValue(undefined),
    insertDeleteVersions: vi.fn().mockResolvedValue(0),
  }
}

const DOWNLOAD_ID = 'test-download-id'

describe('reconcileOffers', () => {
  it('inserts new offers', async () => {
    const repo = createMockRepo()
    const offers = [makeOffer({ id: 'new-1' }), makeOffer({ id: 'new-2' })]

    const result = await reconcileOffers('DF', offers, repo, DOWNLOAD_ID)

    expect(result.created).toBe(2)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(repo.insertVersions).toHaveBeenCalledWith(
      [
        { offer: offers[0], version: 1, operation: 'insert' },
        { offer: offers[1], version: 1, operation: 'insert' },
      ],
      DOWNLOAD_ID,
    )
  })

  it('updates changed offers', async () => {
    const existingMap = new Map([
      ['offer-1', { latestVersion: 1, isActive: true, changed: true }],
    ])
    const repo = createMockRepo(existingMap)
    const offers = [makeOffer({ id: 'offer-1' })]

    const result = await reconcileOffers('DF', offers, repo, DOWNLOAD_ID)

    expect(result.created).toBe(0)
    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(repo.insertVersions).toHaveBeenCalledWith(
      [{ offer: offers[0], version: 2, operation: 'update' }],
      DOWNLOAD_ID,
    )
  })

  it('skips unchanged offers', async () => {
    const existingMap = new Map([
      ['offer-1', { latestVersion: 1, isActive: true, changed: false }],
    ])
    const repo = createMockRepo(existingMap)
    const offers = [makeOffer({ id: 'offer-1' })]

    const result = await reconcileOffers('DF', offers, repo, DOWNLOAD_ID)

    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(1)
    expect(repo.insertVersions).not.toHaveBeenCalled()
  })

  it('re-inserts previously deleted offers', async () => {
    const existingMap = new Map([
      ['offer-1', { latestVersion: 3, isActive: false, changed: true }],
    ])
    const repo = createMockRepo(existingMap)
    const offers = [makeOffer({ id: 'offer-1' })]

    const result = await reconcileOffers('DF', offers, repo, DOWNLOAD_ID)

    expect(result.created).toBe(1)
    expect(result.updated).toBe(0)
    expect(repo.insertVersions).toHaveBeenCalledWith(
      [{ offer: offers[0], version: 4, operation: 'insert' }],
      DOWNLOAD_ID,
    )
  })

  it('inserts delete versions for missing offers', async () => {
    const repo = createMockRepo()
    ;(repo.insertDeleteVersions as ReturnType<typeof vi.fn>).mockResolvedValue(3)

    const result = await reconcileOffers('DF', [makeOffer()], repo, DOWNLOAD_ID)

    expect(result.removed).toBe(3)
    expect(repo.insertDeleteVersions).toHaveBeenCalledWith(
      'DF',
      new Set(['offer-1']),
      DOWNLOAD_ID,
    )
  })

  it('does not call insertVersions when nothing to insert or update', async () => {
    const existingMap = new Map([
      ['offer-1', { latestVersion: 1, isActive: true, changed: false }],
    ])
    const repo = createMockRepo(existingMap)

    await reconcileOffers('DF', [makeOffer()], repo, DOWNLOAD_ID)

    expect(repo.insertVersions).not.toHaveBeenCalled()
  })

  it('reports progress steps', async () => {
    const repo = createMockRepo()
    const steps: ReconcileStep[] = []

    await reconcileOffers('DF', [makeOffer()], repo, DOWNLOAD_ID, (step) =>
      steps.push(step),
    )

    expect(steps.map((s) => s.step)).toEqual([
      'classifying',
      'classified',
      'inserting',
      'removing',
    ])
  })

  it('handles empty offers array', async () => {
    const repo = createMockRepo()

    const result = await reconcileOffers('DF', [], repo, DOWNLOAD_ID)

    expect(result).toEqual({ created: 0, updated: 0, skipped: 0, removed: 0 })
  })

  it('handles mixed insert/update/skip scenario', async () => {
    const existingMap = new Map([
      ['existing-changed', { latestVersion: 2, isActive: true, changed: true }],
      ['existing-same', { latestVersion: 1, isActive: true, changed: false }],
    ])
    const repo = createMockRepo(existingMap)
    const offers = [
      makeOffer({ id: 'new-offer' }),
      makeOffer({ id: 'existing-changed' }),
      makeOffer({ id: 'existing-same' }),
    ]

    const result = await reconcileOffers('DF', offers, repo, DOWNLOAD_ID)

    expect(result.created).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
