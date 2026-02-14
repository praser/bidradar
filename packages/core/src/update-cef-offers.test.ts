import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import {
  updateCefOffers,
  type UpdateCefOffersDeps,
} from './update-cef-offers.js'
import type { OfferRepository } from './offer-repository.js'
import type { Offer } from './offer.js'

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    uf: 'DF',
    city: 'Brasilia',
    neighborhood: 'Asa Sul',
    address: 'SQS 100',
    askingPrice: 100000,
    evaluationPrice: 120000,
    discountPercent: 16.67,
    description: 'Apartamento, 80m2',
    propertyType: 'Apartamento',
    sellingType: 'Venda Direta',
    offerUrl: 'https://example.com/offer-1',
    ...overrides,
  }
}

function createMockDeps() {
  const fetchOffersCsv: Mock<UpdateCefOffersDeps['fetchOffersCsv']> = vi
    .fn()
    .mockResolvedValue({
      content: Buffer.from('csv-content'),
      downloadUrl: 'https://cef.example.com/Lista_imoveis_geral.csv',
    })

  const parseOffers: Mock<UpdateCefOffersDeps['parseOffers']> = vi
    .fn()
    .mockResolvedValue([])

  const store: Mock = vi.fn().mockResolvedValue({
    bucketName: 'test-bucket',
    bucketKey: 'cef-downloads/offer-list/2026-02-13.geral.csv',
  })

  const insert: Mock = vi.fn().mockResolvedValue('fake-download-id')

  const offerRepo: OfferRepository = {
    findExistingOffers: vi.fn().mockResolvedValue(new Map()),
    insertVersions: vi.fn().mockResolvedValue(undefined),
    insertDeleteVersions: vi.fn().mockResolvedValue(0),
  }

  const deps: UpdateCefOffersDeps = {
    fetchOffersCsv,
    parseOffers,
    fileStore: { store },
    metadataRepo: { insert },
    offerRepo,
  }

  return { deps, fetchOffersCsv, parseOffers, store, insert, offerRepo }
}

describe('updateCefOffers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-13T10:00:00Z'))
  })

  it('fetches CSV, stores file, records metadata, and reconciles', async () => {
    const { deps, store, insert, parseOffers } = createMockDeps()
    parseOffers.mockResolvedValue([makeOffer()])

    const result = await updateCefOffers(deps)

    expect(deps.fetchOffersCsv).toHaveBeenCalledWith('geral')
    expect(store).toHaveBeenCalledWith({
      key: expect.stringMatching(
        /^cef-downloads\/offer-list\/2026-02-13\.geral\.[a-f0-9]{8}\.csv$/,
      ),
      content: Buffer.from('csv-content'),
      contentType: 'text/csv',
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: expect.stringMatching(
          /^2026-02-13\.geral\.[a-f0-9]{8}\.csv$/,
        ),
        fileExtension: 'csv',
        fileSize: 11,
        fileType: 'offer-list',
        downloadUrl: 'https://cef.example.com/Lista_imoveis_geral.csv',
        bucketName: 'test-bucket',
        bucketKey: expect.stringMatching(
          /^cef-downloads\/offer-list\/2026-02-13\.geral\.[a-f0-9]{8}\.csv$/,
        ),
      }),
    )
    expect(result.fileSize).toBe(11)
    expect(result.totalOffers).toBe(1)
    expect(result.states).toBe(1)
  })

  it('passes download ID to reconcileOffers', async () => {
    const { deps, parseOffers, offerRepo } = createMockDeps()
    parseOffers.mockResolvedValue([makeOffer()])

    await updateCefOffers(deps)

    // reconcileOffers calls insertDeleteVersions with the downloadId
    expect(offerRepo.insertDeleteVersions).toHaveBeenCalledWith(
      'DF',
      expect.any(Set),
      'fake-download-id',
    )
  })

  it('groups offers by UF and reconciles each state independently', async () => {
    const { deps, parseOffers, offerRepo } = createMockDeps()
    const dfOffer1 = makeOffer({ id: 'df-1', uf: 'DF' })
    const dfOffer2 = makeOffer({ id: 'df-2', uf: 'DF' })
    const spOffer = makeOffer({ id: 'sp-1', uf: 'SP' })
    parseOffers.mockResolvedValue([dfOffer1, dfOffer2, spOffer])

    const result = await updateCefOffers(deps)

    expect(result.states).toBe(2)
    expect(result.totalOffers).toBe(3)

    // reconcileOffers calls findExistingOffers once per state
    expect(offerRepo.findExistingOffers).toHaveBeenCalledTimes(2)

    // First call with DF offers
    const firstCall = (offerRepo.findExistingOffers as Mock).mock.calls[0] as [
      readonly Offer[],
    ]
    expect(firstCall[0]).toHaveLength(2)
    expect(firstCall[0][0]!.uf).toBe('DF')

    // Second call with SP offers
    const secondCall = (offerRepo.findExistingOffers as Mock).mock
      .calls[1] as [readonly Offer[]]
    expect(secondCall[0]).toHaveLength(1)
    expect(secondCall[0][0]!.uf).toBe('SP')
  })

  it('handles empty offer list', async () => {
    const { deps, offerRepo } = createMockDeps()

    const result = await updateCefOffers(deps)

    expect(result.totalOffers).toBe(0)
    expect(result.states).toBe(0)
    expect(result.results.size).toBe(0)
    expect(offerRepo.findExistingOffers).not.toHaveBeenCalled()
  })

  it('propagates fetch failure', async () => {
    const { deps, fetchOffersCsv, store } = createMockDeps()
    fetchOffersCsv.mockRejectedValue(new Error('Download failed'))

    await expect(updateCefOffers(deps)).rejects.toThrow('Download failed')
    expect(store).not.toHaveBeenCalled()
  })

  it('propagates file store failure', async () => {
    const { deps, store, insert } = createMockDeps()
    store.mockRejectedValue(new Error('S3 upload failed'))

    await expect(updateCefOffers(deps)).rejects.toThrow('S3 upload failed')
    expect(insert).not.toHaveBeenCalled()
  })

  it('stores file before recording metadata', async () => {
    const { deps, store, insert } = createMockDeps()
    const callOrder: string[] = []
    store.mockImplementation(async () => {
      callOrder.push('store')
      return { bucketName: 'b', bucketKey: 'k' }
    })
    insert.mockImplementation(async () => {
      callOrder.push('insert')
      return 'fake-download-id'
    })

    await updateCefOffers(deps)

    expect(callOrder).toEqual(['store', 'insert'])
  })

  it('returns results keyed by state code', async () => {
    const { deps, parseOffers } = createMockDeps()
    parseOffers.mockResolvedValue([
      makeOffer({ id: '1', uf: 'RJ' }),
      makeOffer({ id: '2', uf: 'MG' }),
    ])

    const result = await updateCefOffers(deps)

    expect(result.results.has('RJ')).toBe(true)
    expect(result.results.has('MG')).toBe(true)
    expect(result.results.size).toBe(2)
  })
})
