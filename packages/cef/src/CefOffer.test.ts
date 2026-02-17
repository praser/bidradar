import { describe, it, expect } from 'vitest'
import { CefOffer } from './CefOffer.js'

const validRow = [
  '12345',                        // id
  ' df ',                         // uf (should be trimmed and uppercased)
  ' Brasilia ',                   // city
  ' Asa Sul ',                    // neighborhood
  ' SQS 101 Bloco A ',           // address
  '100.000,00',                   // askingPrice (Brazilian format)
  '120.000,00',                   // evaluationPrice
  '16.67',                        // discountPercent
  ' Apartamento, 80.00 de área total, 2 qto(s) ', // description
  ' Venda Direta ',               // sellingType
  'https://example.com/offer/12345', // offerUrl
]

describe('CefOffer', () => {
  it('parses a valid row', () => {
    const offer = new CefOffer(validRow)
    expect(offer.id).toBe('12345')
    expect(offer.uf).toBe('DF')
    expect(offer.city).toBe('Brasilia')
    expect(offer.neighborhood).toBe('Asa Sul')
    expect(offer.address).toBe('SQS 101 Bloco A')
    expect(offer.askingPrice).toBe(100000)
    expect(offer.evaluationPrice).toBe(120000)
    expect(offer.discountPercent).toBe(16.67)
    expect(offer.description).toBe('Apartamento, 80.00 de área total, 2 qto(s)')
    expect(offer.sellingType).toBe('Venda Direta')
    expect(offer.offerUrl).toBe('https://example.com/offer/12345')
    expect(offer.registrationUrl).toBe('https://venda-imoveis.caixa.gov.br/editais/matricula/DF/12345.pdf')
  })

  it('extracts propertyType from description', () => {
    const offer = new CefOffer(validRow)
    expect(offer.propertyType).toBe('Apartamento')
  })

  it('trims and uppercases UF', () => {
    const offer = new CefOffer(validRow)
    expect(offer.uf).toBe('DF')
  })

  it('parses Brazilian-formatted prices', () => {
    const row = [...validRow]
    row[5] = '1.234.567,89'
    row[6] = '2.000.000,00'
    const offer = new CefOffer(row)
    expect(offer.askingPrice).toBe(1234567.89)
    expect(offer.evaluationPrice).toBe(2000000)
  })

  it('throws on too few columns', () => {
    expect(() => new CefOffer(['a', 'b'])).toThrow()
  })

  it('throws on invalid URL', () => {
    const row = [...validRow]
    row[10] = 'not-a-url'
    expect(() => new CefOffer(row)).toThrow()
  })

  it('implements the Offer interface', () => {
    const offer = new CefOffer(validRow)
    // Verify all Offer interface properties exist
    expect(typeof offer.id).toBe('string')
    expect(typeof offer.uf).toBe('string')
    expect(typeof offer.city).toBe('string')
    expect(typeof offer.neighborhood).toBe('string')
    expect(typeof offer.address).toBe('string')
    expect(typeof offer.askingPrice).toBe('number')
    expect(typeof offer.evaluationPrice).toBe('number')
    expect(typeof offer.discountPercent).toBe('number')
    expect(typeof offer.description).toBe('string')
    expect(typeof offer.propertyType).toBe('string')
    expect(typeof offer.sellingType).toBe('string')
    expect(typeof offer.offerUrl).toBe('string')
    expect(typeof offer.registrationUrl).toBe('string')
  })

  it('handles empty propertyType from description', () => {
    const row = [...validRow]
    row[8] = ''
    const offer = new CefOffer(row)
    expect(offer.propertyType).toBe('')
  })
})
