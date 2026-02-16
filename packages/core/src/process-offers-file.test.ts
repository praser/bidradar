import { describe, it, expect, vi, type Mock } from 'vitest'
import {
  processOffersFile,
  type ProcessOffersFileDeps,
} from './process-offers-file.js'
import type { OfferRepository } from './offer-repository.js'
import type { Offer } from './offer.js'
import type { DownloadMetadata } from './update-cef-offers.js'

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
  const parseOffers: Mock<ProcessOffersFileDeps['parseOffers']> = vi
    .fn()
    .mockResolvedValue([])

  const insert: Mock = vi.fn().mockResolvedValue('fake-download-id')

  const offerRepo: OfferRepository = {
    findExistingOffers: vi.fn().mockResolvedValue(new Map()),
    insertVersions: vi.fn().mockResolvedValue(undefined),
    insertDeleteVersions: vi.fn().mockResolvedValue(0),
    findOffersNeedingDetails: vi.fn().mockResolvedValue([]),
  }

  const deps: ProcessOffersFileDeps = {
    parseOffers,
    metadataRepo: { insert, findByContentHash: vi.fn().mockResolvedValue(undefined) },
    offerRepo,
  }

  return { deps, parseOffers, insert, offerRepo }
}

function makeMetadata(): Omit<DownloadMetadata, 'fileSize'> {
  return {
    fileName: '2026-02-14.geral.abc12345.csv',
    fileExtension: 'csv',
    fileType: 'offer-list',
    downloadUrl: 'https://cef.example.com/Lista_imoveis_geral.csv',
    downloadedAt: new Date('2026-02-14T10:00:00Z'),
    bucketName: 'test-bucket',
    bucketKey: 'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
  }
}

describe('processOffersFile', () => {
  it('records metadata, parses offers, and reconciles', async () => {
    const { deps, parseOffers, insert } = createMockDeps()
    parseOffers.mockResolvedValue([makeOffer()])
    const content = Buffer.from('csv-content')
    const metadata = makeMetadata()

    const result = await processOffersFile(content, metadata, deps)

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ...metadata,
        fileSize: content.length,
      }),
    )
    expect(parseOffers).toHaveBeenCalledWith(content)
    expect(result.fileSize).toBe(content.length)
    expect(result.totalOffers).toBe(1)
    expect(result.states).toBe(1)
  })

  it('groups offers by UF and reconciles each state', async () => {
    const { deps, parseOffers, offerRepo } = createMockDeps()
    parseOffers.mockResolvedValue([
      makeOffer({ id: 'df-1', uf: 'DF' }),
      makeOffer({ id: 'df-2', uf: 'DF' }),
      makeOffer({ id: 'sp-1', uf: 'SP' }),
    ])

    const result = await processOffersFile(Buffer.from('csv'), makeMetadata(), deps)

    expect(result.states).toBe(2)
    expect(result.totalOffers).toBe(3)
    expect(offerRepo.findExistingOffers).toHaveBeenCalledTimes(2)
  })

  it('handles empty offer list', async () => {
    const { deps, offerRepo } = createMockDeps()

    const result = await processOffersFile(Buffer.from('csv'), makeMetadata(), deps)

    expect(result.totalOffers).toBe(0)
    expect(result.states).toBe(0)
    expect(result.results.size).toBe(0)
    expect(offerRepo.findExistingOffers).not.toHaveBeenCalled()
  })

  it('returns results keyed by state code', async () => {
    const { deps, parseOffers } = createMockDeps()
    parseOffers.mockResolvedValue([
      makeOffer({ id: '1', uf: 'RJ' }),
      makeOffer({ id: '2', uf: 'MG' }),
    ])

    const result = await processOffersFile(Buffer.from('csv'), makeMetadata(), deps)

    expect(result.results.has('RJ')).toBe(true)
    expect(result.results.has('MG')).toBe(true)
    expect(result.results.size).toBe(2)
  })
})
