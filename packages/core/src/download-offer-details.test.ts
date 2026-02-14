import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  downloadOfferDetails,
  type DownloadOfferDetailsDeps,
  type OfferForDetailDownload,
} from './download-offer-details.js'

function makeDeps(overrides?: Partial<DownloadOfferDetailsDeps>): DownloadOfferDetailsDeps {
  return {
    fetchBinary: vi.fn().mockResolvedValue(Buffer.from('<html>detail</html>')),
    fileStore: {
      store: vi.fn().mockResolvedValue({ bucketName: 'bucket', bucketKey: 'key' }),
      get: vi.fn(),
    },
    metadataRepo: {
      insert: vi.fn().mockResolvedValue('download-id'),
      findByContentHash: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  }
}

function makeOffers(count: number): OfferForDetailDownload[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `offer-${i}`,
    sourceId: `source-${i}`,
    offerUrl: `https://example.com/detail/${i}`,
  }))
}

describe('downloadOfferDetails', () => {
  it('uploads new detail pages', async () => {
    const deps = makeDeps()
    const offers = makeOffers(2)

    const result = await downloadOfferDetails(offers, deps, { rateLimit: 1000 })

    expect(result.total).toBe(2)
    expect(result.uploaded).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)
    expect(deps.fileStore.store).toHaveBeenCalledTimes(2)
    expect(deps.metadataRepo.insert).toHaveBeenCalledTimes(2)
  })

  it('skips when content hash already exists', async () => {
    const deps = makeDeps({
      metadataRepo: {
        insert: vi.fn(),
        findByContentHash: vi.fn().mockResolvedValue({ id: 'existing-id' }),
      },
    })
    const offers = makeOffers(1)

    const result = await downloadOfferDetails(offers, deps, { rateLimit: 1000 })

    expect(result.total).toBe(1)
    expect(result.uploaded).toBe(0)
    expect(result.skipped).toBe(1)
    expect(deps.fileStore.store).not.toHaveBeenCalled()
  })

  it('handles individual errors without aborting batch', async () => {
    const fetchBinary = vi.fn()
      .mockResolvedValueOnce(Buffer.from('page1'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(Buffer.from('page3'))
    const deps = makeDeps({ fetchBinary })
    const offers = makeOffers(3)

    const result = await downloadOfferDetails(offers, deps, { rateLimit: 1000 })

    expect(result.total).toBe(3)
    expect(result.uploaded).toBe(2)
    expect(result.errors).toBe(1)
  })

  it('calls onProgress for each offer', async () => {
    const deps = makeDeps()
    const offers = makeOffers(2)
    const progress = vi.fn()

    await downloadOfferDetails(offers, deps, {
      rateLimit: 1000,
      onProgress: progress,
    })

    expect(progress).toHaveBeenCalledTimes(2)
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0, total: 2, outcome: 'uploaded' }),
    )
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1, total: 2, outcome: 'uploaded' }),
    )
  })

  it('reports error message in progress callback', async () => {
    const deps = makeDeps({
      fetchBinary: vi.fn().mockRejectedValue(new Error('timeout')),
    })
    const offers = makeOffers(1)
    const progress = vi.fn()

    await downloadOfferDetails(offers, deps, {
      rateLimit: 1000,
      onProgress: progress,
    })

    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'error', error: 'timeout' }),
    )
  })

  it('returns empty result for empty offers list', async () => {
    const deps = makeDeps()

    const result = await downloadOfferDetails([], deps)

    expect(result).toEqual({ total: 0, uploaded: 0, skipped: 0, errors: 0 })
  })

  it('stores files with correct content type', async () => {
    const deps = makeDeps()
    const offers = makeOffers(1)

    await downloadOfferDetails(offers, deps, { rateLimit: 1000 })

    expect(deps.fileStore.store).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'text/html' }),
    )
  })

  it('records metadata with offer-details fileType', async () => {
    const deps = makeDeps()
    const offers = makeOffers(1)

    await downloadOfferDetails(offers, deps, { rateLimit: 1000 })

    expect(deps.metadataRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        fileType: 'offer-details',
        fileExtension: 'html',
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    )
  })
})
