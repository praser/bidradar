import { describe, it, expect, vi } from 'vitest'
import {
  buildCefS3Key,
  parseCefS3Key,
  buildCefDownloadUrl,
  getCefFileDescriptor,
  CEF_BASE_URL,
  CEF_FILE_TYPES,
  type CefFileType,
} from './cef-file.js'

describe('CEF_FILE_TYPES', () => {
  it('contains all 5 file types', () => {
    expect(CEF_FILE_TYPES).toEqual([
      'offer-list',
      'auctions-schedule',
      'licensed-brokers',
      'accredited-auctioneers',
      'offer-details',
    ])
  })
})

describe('getCefFileDescriptor', () => {
  it('returns descriptor for offer-list', () => {
    const d = getCefFileDescriptor('offer-list')
    expect(d.extension).toBe('csv')
    expect(d.contentType).toBe('text/csv')
    expect(d.hasUf).toBe(true)
  })

  it('returns descriptor for auctions-schedule', () => {
    const d = getCefFileDescriptor('auctions-schedule')
    expect(d.extension).toBe('pdf')
    expect(d.contentType).toBe('application/pdf')
    expect(d.hasUf).toBe(false)
  })

  it('returns descriptor for licensed-brokers', () => {
    const d = getCefFileDescriptor('licensed-brokers')
    expect(d.extension).toBe('zip')
    expect(d.contentType).toBe('application/zip')
    expect(d.hasUf).toBe(false)
  })

  it('returns descriptor for accredited-auctioneers', () => {
    const d = getCefFileDescriptor('accredited-auctioneers')
    expect(d.extension).toBe('pdf')
    expect(d.contentType).toBe('application/pdf')
    expect(d.hasUf).toBe(false)
  })

  it('returns descriptor for offer-details', () => {
    const d = getCefFileDescriptor('offer-details')
    expect(d.extension).toBe('html')
    expect(d.contentType).toBe('text/html')
    expect(d.hasUf).toBe(false)
  })
})

describe('buildCefS3Key', () => {
  it('builds offer-list key with uf', () => {
    const key = buildCefS3Key({
      fileType: 'offer-list',
      uf: 'geral',
      date: '2026-02-14',
      runId: 'abc12345',
    })
    expect(key).toBe('cef-downloads/offer-list/2026-02-14.geral.abc12345.csv')
  })

  it('generates date from current time when not provided', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'))

    const key = buildCefS3Key({
      fileType: 'offer-list',
      uf: 'DF',
      runId: 'deadbeef',
    })
    expect(key).toBe('cef-downloads/offer-list/2026-03-01.DF.deadbeef.csv')

    vi.useRealTimers()
  })

  it('generates random runId when not provided', () => {
    const key = buildCefS3Key({
      fileType: 'offer-list',
      uf: 'geral',
      date: '2026-02-14',
    })
    expect(key).toMatch(
      /^cef-downloads\/offer-list\/2026-02-14\.geral\.[a-f0-9]{8}\.csv$/,
    )
  })

  it('builds auctions-schedule key', () => {
    const key = buildCefS3Key({
      fileType: 'auctions-schedule',
      date: '2026-02-14',
      runId: 'abc12345',
    })
    expect(key).toBe(
      'cef-downloads/auctions-schedule/2026-02-14.auctions-schedule.abc12345.pdf',
    )
  })

  it('builds licensed-brokers key', () => {
    const key = buildCefS3Key({
      fileType: 'licensed-brokers',
      date: '2026-02-14',
      runId: 'abc12345',
    })
    expect(key).toBe(
      'cef-downloads/licensed-brokers/2026-02-14.licensed-brokers.abc12345.zip',
    )
  })

  it('builds accredited-auctioneers key', () => {
    const key = buildCefS3Key({
      fileType: 'accredited-auctioneers',
      date: '2026-02-14',
      runId: 'abc12345',
    })
    expect(key).toBe(
      'cef-downloads/accredited-auctioneers/2026-02-14.accredited-auctioneers.abc12345.pdf',
    )
  })

  it('builds offer-details key with offerId', () => {
    const key = buildCefS3Key({
      fileType: 'offer-details',
      offerId: 'offer-uuid-123',
      date: '2026-02-14',
      runId: 'abc12345',
    })
    expect(key).toBe(
      'cef-downloads/offer-details/offer-uuid-123/2026-02-14.offer-details.abc12345.html',
    )
  })
})

describe('parseCefS3Key', () => {
  it('extracts all components from an offer-list key', () => {
    const parsed = parseCefS3Key(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )
    expect(parsed).toEqual({
      fileType: 'offer-list',
      date: '2026-02-14',
      uf: 'geral',
      runId: 'abc12345',
      fileName: '2026-02-14.geral.abc12345.csv',
      extension: 'csv',
    })
  })

  it('parses auctions-schedule key', () => {
    const parsed = parseCefS3Key(
      'cef-downloads/auctions-schedule/2026-02-14.auctions-schedule.abc12345.pdf',
    )
    expect(parsed).toEqual({
      fileType: 'auctions-schedule',
      date: '2026-02-14',
      runId: 'abc12345',
      fileName: '2026-02-14.auctions-schedule.abc12345.pdf',
      extension: 'pdf',
    })
  })

  it('parses licensed-brokers key', () => {
    const parsed = parseCefS3Key(
      'cef-downloads/licensed-brokers/2026-02-14.licensed-brokers.abc12345.zip',
    )
    expect(parsed).toEqual({
      fileType: 'licensed-brokers',
      date: '2026-02-14',
      runId: 'abc12345',
      fileName: '2026-02-14.licensed-brokers.abc12345.zip',
      extension: 'zip',
    })
  })

  it('parses offer-details key with offerId', () => {
    const parsed = parseCefS3Key(
      'cef-downloads/offer-details/offer-uuid-123/2026-02-14.offer-details.abc12345.html',
    )
    expect(parsed).toEqual({
      fileType: 'offer-details',
      date: '2026-02-14',
      runId: 'abc12345',
      fileName: '2026-02-14.offer-details.abc12345.html',
      extension: 'html',
      offerId: 'offer-uuid-123',
    })
  })

  it('round-trips offer-list with buildCefS3Key', () => {
    const key = buildCefS3Key({
      fileType: 'offer-list',
      uf: 'SP',
      date: '2026-01-15',
      runId: 'aabbccdd',
    })
    const parsed = parseCefS3Key(key)
    expect(parsed.fileType).toBe('offer-list')
    expect(parsed.uf).toBe('SP')
    expect(parsed.date).toBe('2026-01-15')
    expect(parsed.runId).toBe('aabbccdd')
    expect(parsed.extension).toBe('csv')
  })

  it('round-trips offer-details with buildCefS3Key', () => {
    const key = buildCefS3Key({
      fileType: 'offer-details',
      offerId: 'my-offer-id',
      date: '2026-01-15',
      runId: 'aabbccdd',
    })
    const parsed = parseCefS3Key(key)
    expect(parsed.fileType).toBe('offer-details')
    expect(parsed.offerId).toBe('my-offer-id')
    expect(parsed.date).toBe('2026-01-15')
    expect(parsed.runId).toBe('aabbccdd')
    expect(parsed.extension).toBe('html')
  })

  it('round-trips bulk types with buildCefS3Key', () => {
    const types: CefFileType[] = [
      'auctions-schedule',
      'licensed-brokers',
      'accredited-auctioneers',
    ]
    for (const fileType of types) {
      const key = buildCefS3Key({
        fileType,
        date: '2026-01-15',
        runId: 'aabbccdd',
      })
      const parsed = parseCefS3Key(key)
      expect(parsed.fileType).toBe(fileType)
      expect(parsed.date).toBe('2026-01-15')
      expect(parsed.runId).toBe('aabbccdd')
    }
  })
})

describe('buildCefDownloadUrl', () => {
  it('builds offer-list URL with uf', () => {
    expect(buildCefDownloadUrl('offer-list', { uf: 'geral' })).toBe(
      `${CEF_BASE_URL}/Lista_imoveis_geral.csv`,
    )
  })

  it('builds offer-list URL for specific state', () => {
    expect(buildCefDownloadUrl('offer-list', { uf: 'DF' })).toBe(
      `${CEF_BASE_URL}/Lista_imoveis_DF.csv`,
    )
  })

  it('builds auctions-schedule URL', () => {
    expect(buildCefDownloadUrl('auctions-schedule')).toBe(
      'https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/calendario-leiloes-imoveis-caixa.pdf',
    )
  })

  it('builds licensed-brokers URL', () => {
    expect(buildCefDownloadUrl('licensed-brokers')).toBe(
      `${CEF_BASE_URL}/lista_corretores.zip`,
    )
  })

  it('builds accredited-auctioneers URL', () => {
    expect(buildCefDownloadUrl('accredited-auctioneers')).toBe(
      'https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/Relacao_Leiloeiros.pdf',
    )
  })

  it('builds offer-details URL with sourceId', () => {
    expect(
      buildCefDownloadUrl('offer-details', { sourceId: '123456' }),
    ).toBe(
      'https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=123456',
    )
  })
})
