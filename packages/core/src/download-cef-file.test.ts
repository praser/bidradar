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

    const result = await downloadCefFile('auctions-schedule', deps)

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

    const result = await downloadCefFile('auctions-schedule', deps)

    expect(result.outcome).toBe('skipped')
    expect(result.fileSize).toBe(12)
    expect(result.s3Key).toBeUndefined()
    expect(result.downloadId).toBeUndefined()
    expect(deps.fileStore.store).not.toHaveBeenCalled()
    expect(deps.metadataRepo.insert).not.toHaveBeenCalled()
  })

  it('passes correct URL to fetchBinary for offer-list', async () => {
    const deps = makeDeps()

    await downloadCefFile('offer-list', deps, { uf: 'DF' })

    expect(deps.fetchBinary).toHaveBeenCalledWith(
      'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_DF.csv',
    )
  })

  it('passes correct URL for auctions-schedule', async () => {
    const deps = makeDeps()

    await downloadCefFile('auctions-schedule', deps)

    expect(deps.fetchBinary).toHaveBeenCalledWith(
      'https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/calendario-leiloes-imoveis-caixa.pdf',
    )
  })

  it('stores file with correct content type', async () => {
    const deps = makeDeps()

    await downloadCefFile('licensed-brokers', deps)

    expect(deps.fileStore.store).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'application/zip' }),
    )
  })

  it('records metadata with content hash', async () => {
    const deps = makeDeps()

    await downloadCefFile('accredited-auctioneers', deps)

    expect(deps.metadataRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        fileType: 'accredited-auctioneers',
        fileExtension: 'pdf',
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    )
  })
})
