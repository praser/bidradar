import { createHash } from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadCefFile, type DownloadCefFileDeps } from './download-cef-file.js'

function makeDeps(overrides?: Partial<DownloadCefFileDeps>): DownloadCefFileDeps {
  return {
    fetchBinary: vi.fn().mockResolvedValue(Buffer.from('test-content')),
    fileStore: {
      store: vi.fn().mockResolvedValue({ bucketName: 'bucket', bucketKey: 'key' }),
      get: vi.fn(),
    },
    metadataRepo: {
      insert: vi.fn().mockResolvedValue('download-id-1'),
      findByContentHash: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  }
}

describe('downloadCefFile', () => {
  it('uploads a new file when hash is not found', async () => {
    const deps = makeDeps()

    const result = await downloadCefFile('auctions-schedule', deps, {
      url: 'https://example.com/file.pdf',
    })

    expect(result.outcome).toBe('uploaded')
    expect(result.fileSize).toBe(12)
    expect(result.s3Key).toBeDefined()
    expect(result.downloadId).toBe('download-id-1')
    expect(result.contentHash).toBe(
      createHash('sha256').update(Buffer.from('test-content')).digest('hex'),
    )
    expect(deps.fileStore.store).toHaveBeenCalledTimes(1)
    expect(deps.metadataRepo.insert).toHaveBeenCalledTimes(1)
  })

  it('skips upload when content hash already exists', async () => {
    const deps = makeDeps({
      metadataRepo: {
        insert: vi.fn(),
        findByContentHash: vi.fn().mockResolvedValue({ id: 'existing-id' }),
      },
    })

    const result = await downloadCefFile('auctions-schedule', deps, {
      url: 'https://example.com/file.pdf',
    })

    expect(result.outcome).toBe('skipped')
    expect(result.fileSize).toBe(12)
    expect(result.s3Key).toBeUndefined()
    expect(result.downloadId).toBeUndefined()
    expect(deps.fileStore.store).not.toHaveBeenCalled()
    expect(deps.metadataRepo.insert).not.toHaveBeenCalled()
  })

  it('passes URL directly to fetchBinary', async () => {
    const deps = makeDeps()
    const url = 'https://example.com/Lista_imoveis_DF.csv'

    await downloadCefFile('offer-list', deps, { url, uf: 'DF' })

    expect(deps.fetchBinary).toHaveBeenCalledWith(url)
  })

  it('stores file with correct content type', async () => {
    const deps = makeDeps()

    await downloadCefFile('licensed-brokers', deps, {
      url: 'https://example.com/brokers.zip',
    })

    expect(deps.fileStore.store).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'application/zip' }),
    )
  })

  it('records metadata with content hash', async () => {
    const deps = makeDeps()

    await downloadCefFile('accredited-auctioneers', deps, {
      url: 'https://example.com/auctioneers.pdf',
    })

    expect(deps.metadataRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        fileType: 'accredited-auctioneers',
        fileExtension: 'pdf',
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        downloadUrl: 'https://example.com/auctioneers.pdf',
      }),
    )
  })

  it('passes offerId to S3 key builder for offer-details', async () => {
    const deps = makeDeps()

    const result = await downloadCefFile('offer-details', deps, {
      url: 'https://example.com/detail.html',
      offerId: 'offer-123',
    })

    expect(result.outcome).toBe('uploaded')
    expect(result.s3Key).toContain('offer-details')
    expect(result.s3Key).toContain('offer-123')
  })
})
