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
  existingMap: Map<string, { internalId: string; version: number; changed: boolean }> = new Map(),
): OfferRepository {
  return {
    findExistingOffers: vi.fn().mockResolvedValue(existingMap),
    insertMany: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue(undefined),
    touchManyLastSeen: vi.fn().mockResolvedValue(undefined),
    softDeleteMissing: vi.fn().mockResolvedValue(0),
  }
}

describe('reconcileOffers', () => {
  it('inserts new offers', async () => {
    const repo = createMockRepo()
    const offers = [makeOffer({ id: 'new-1' }), makeOffer({ id: 'new-2' })]

    const result = await reconcileOffers('DF', offers, repo)

    expect(result.created).toBe(2)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(repo.insertMany).toHaveBeenCalledWith(offers)
  })

  it('updates changed offers', async () => {
    const existingMap = new Map([
      ['offer-1', { internalId: 'uuid-1', version: 1, changed: true }],
    ])
    const repo = createMockRepo(existingMap)
    const offers = [makeOffer({ id: 'offer-1' })]

    const result = await reconcileOffers('DF', offers, repo)

    expect(result.created).toBe(0)
    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(repo.updateMany).toHaveBeenCalledWith([
      { internalId: 'uuid-1', version: 1, offer: offers[0] },
    ])
  })

  it('touches unchanged offers', async () => {
    const existingMap = new Map([
      ['offer-1', { internalId: 'uuid-1', version: 1, changed: false }],
    ])
    const repo = createMockRepo(existingMap)
    const offers = [makeOffer({ id: 'offer-1' })]

    const result = await reconcileOffers('DF', offers, repo)

    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(1)
    expect(repo.touchManyLastSeen).toHaveBeenCalledWith(['uuid-1'])
  })

  it('soft-deletes missing offers', async () => {
    const repo = createMockRepo()
    ;(repo.softDeleteMissing as ReturnType<typeof vi.fn>).mockResolvedValue(3)

    const result = await reconcileOffers('DF', [makeOffer()], repo)

    expect(result.removed).toBe(3)
    expect(repo.softDeleteMissing).toHaveBeenCalledWith('DF', new Set(['offer-1']))
  })

  it('does not call insertMany when nothing to insert', async () => {
    const existingMap = new Map([
      ['offer-1', { internalId: 'uuid-1', version: 1, changed: false }],
    ])
    const repo = createMockRepo(existingMap)

    await reconcileOffers('DF', [makeOffer()], repo)

    expect(repo.insertMany).not.toHaveBeenCalled()
  })

  it('does not call updateMany when nothing to update', async () => {
    const repo = createMockRepo()

    await reconcileOffers('DF', [makeOffer()], repo)

    expect(repo.updateMany).not.toHaveBeenCalled()
  })

  it('does not call touchManyLastSeen when nothing to touch', async () => {
    const repo = createMockRepo()

    await reconcileOffers('DF', [makeOffer()], repo)

    expect(repo.touchManyLastSeen).not.toHaveBeenCalled()
  })

  it('reports progress steps', async () => {
    const repo = createMockRepo()
    const steps: ReconcileStep[] = []

    await reconcileOffers('DF', [makeOffer()], repo, (step) => steps.push(step))

    expect(steps.map((s) => s.step)).toEqual([
      'classifying',
      'classified',
      'inserting',
      'updating',
      'touching',
      'removing',
    ])
  })

  it('handles empty offers array', async () => {
    const repo = createMockRepo()

    const result = await reconcileOffers('DF', [], repo)

    expect(result).toEqual({ created: 0, updated: 0, skipped: 0, removed: 0 })
  })

  it('handles mixed insert/update/touch scenario', async () => {
    const existingMap = new Map([
      ['existing-changed', { internalId: 'uuid-1', version: 2, changed: true }],
      ['existing-same', { internalId: 'uuid-2', version: 1, changed: false }],
    ])
    const repo = createMockRepo(existingMap)
    const offers = [
      makeOffer({ id: 'new-offer' }),
      makeOffer({ id: 'existing-changed' }),
      makeOffer({ id: 'existing-same' }),
    ]

    const result = await reconcileOffers('DF', offers, repo)

    expect(result.created).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
