import { describe, it, expect } from 'vitest'
import type { Offer } from '@bidradar/core'
import { resolveColumns, renderTable } from './formatTable.js'

const sampleOffer: Offer = {
  id: 'abc-123',
  uf: 'DF',
  city: 'Brasilia',
  neighborhood: 'Asa Norte',
  address: 'SQN 208 Bloco A',
  askingPrice: 250_000,
  evaluationPrice: 350_000,
  discountPercent: 28.57,
  description: 'Apartamento 3 quartos',
  propertyType: 'Apartamento',
  sellingType: 'Licitacao',
  offerUrl: 'https://example.com/offer/abc-123',
}

describe('resolveColumns', () => {
  it('returns default columns when no input is given', () => {
    const cols = resolveColumns()
    const keys = cols.map((c) => c.key)
    expect(keys).toEqual([
      'uf',
      'city',
      'propertyType',
      'sellingType',
      'askingPrice',
      'evaluationPrice',
      'discountPercent',
      'description',
    ])
  })

  it('returns specified columns in order', () => {
    const cols = resolveColumns('id,uf,askingPrice')
    expect(cols.map((c) => c.key)).toEqual(['id', 'uf', 'askingPrice'])
  })

  it('throws on unknown column', () => {
    expect(() => resolveColumns('id,unknown')).toThrowError(
      /Unknown column "unknown"/,
    )
  })

  it('trims whitespace from column names', () => {
    const cols = resolveColumns(' uf , city ')
    expect(cols.map((c) => c.key)).toEqual(['uf', 'city'])
  })
})

describe('renderTable', () => {
  it('renders a table string with default columns', () => {
    const table = renderTable([sampleOffer])
    expect(table).toContain('DF')
    expect(table).toContain('Brasilia')
    expect(table).toContain('Apartamento')
  })

  it('renders with custom columns', () => {
    const table = renderTable([sampleOffer], 'id,uf')
    expect(table).toContain('abc-123')
    expect(table).toContain('DF')
    // Should not contain columns we did not request
    expect(table).not.toContain('Brasilia')
  })

  it('formats BRL currency values', () => {
    const table = renderTable([sampleOffer], 'askingPrice')
    // BRL formatting with pt-BR locale
    expect(table).toMatch(/250/)
  })

  it('formats discount as percentage', () => {
    const table = renderTable([sampleOffer], 'discountPercent')
    expect(table).toMatch(/28/)
  })

  it('truncates long description values', () => {
    const offer: Offer = {
      ...sampleOffer,
      description: 'A very long description that exceeds the max width limit set for description column',
    }
    const table = renderTable([offer], 'description')
    // The description column has maxWidth of 25, so it should be truncated
    expect(table).toContain('\u2026')
  })

  it('handles null/undefined values with a dash', () => {
    // Cast to simulate null values that could arrive from the API
    const offer = { ...sampleOffer, city: null } as unknown as Offer
    const table = renderTable([offer], 'city')
    expect(table).toContain('-')
  })

  it('renders empty state gracefully', () => {
    const table = renderTable([])
    expect(typeof table).toBe('string')
  })
})
