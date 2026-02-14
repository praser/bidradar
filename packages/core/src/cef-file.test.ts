import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildCefS3Key,
  parseCefS3Key,
  buildCefDownloadUrl,
  CEF_BASE_URL,
} from './cef-file.js'

describe('buildCefS3Key', () => {
  it('builds key with provided date and runId', () => {
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
})

describe('parseCefS3Key', () => {
  it('extracts all components from a valid key', () => {
    const parsed = parseCefS3Key(
      'cef-downloads/offer-list/2026-02-14.geral.abc12345.csv',
    )
    expect(parsed).toEqual({
      fileType: 'offer-list',
      date: '2026-02-14',
      uf: 'geral',
      runId: 'abc12345',
      fileName: '2026-02-14.geral.abc12345.csv',
    })
  })

  it('round-trips with buildCefS3Key', () => {
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
  })
})

describe('buildCefDownloadUrl', () => {
  it('builds offer-list URL', () => {
    expect(buildCefDownloadUrl('offer-list', 'geral')).toBe(
      `${CEF_BASE_URL}/Lista_imoveis_geral.csv`,
    )
  })

  it('builds URL for specific state', () => {
    expect(buildCefDownloadUrl('offer-list', 'DF')).toBe(
      `${CEF_BASE_URL}/Lista_imoveis_DF.csv`,
    )
  })
})
