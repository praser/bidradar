import { describe, it, expect } from 'vitest'
import { parseDescription } from './parse-description.js'

describe('parseDescription', () => {
  it('parses total area', () => {
    const result = parseDescription('250.00 de área total, 2 qto(s)')
    expect(result.totalArea).toBe(250)
  })

  it('parses private area', () => {
    const result = parseDescription('120.50 de área privativa')
    expect(result.privateArea).toBe(120.5)
  })

  it('parses land area', () => {
    const result = parseDescription('300.00 de área do terreno')
    expect(result.landArea).toBe(300)
  })

  it('parses bedrooms', () => {
    const result = parseDescription('3 qto(s), 1 sala(s)')
    expect(result.bedrooms).toBe(3)
  })

  it('parses bathrooms with count', () => {
    const result = parseDescription('2 WC')
    expect(result.bathrooms).toBe(2)
  })

  it('parses single WC without count prefix', () => {
    const result = parseDescription('WC, cozinha')
    expect(result.bathrooms).toBe(1)
  })

  it('parses living rooms', () => {
    const result = parseDescription('2 sala(s)')
    expect(result.livingRooms).toBe(2)
  })

  it('detects kitchen', () => {
    const result = parseDescription('1 qto(s), cozinha')
    expect(result.kitchens).toBe(1)
  })

  it('returns null for missing kitchen', () => {
    const result = parseDescription('1 qto(s)')
    expect(result.kitchens).toBeNull()
  })

  it('parses garage spaces', () => {
    const result = parseDescription('2 vaga(s) de garagem')
    expect(result.garageSpaces).toBe(2)
  })

  it('detects service area', () => {
    const result = parseDescription('a.serv, cozinha')
    expect(result.hasServiceArea).toBe(true)
  })

  it('returns false for missing service area', () => {
    const result = parseDescription('cozinha')
    expect(result.hasServiceArea).toBe(false)
  })

  it('returns all nulls for empty description', () => {
    const result = parseDescription('')
    expect(result).toEqual({
      totalArea: null,
      privateArea: null,
      landArea: null,
      bedrooms: null,
      bathrooms: null,
      livingRooms: null,
      kitchens: null,
      garageSpaces: null,
      hasServiceArea: false,
    })
  })

  it('parses a realistic full description', () => {
    const desc =
      'Apartamento, 80.00 de área total, 60.00 de área privativa, 3 qto(s), 1 sala(s), 2 WC, cozinha, a.serv, 1 vaga(s) de garagem'
    const result = parseDescription(desc)
    expect(result).toEqual({
      totalArea: 80,
      privateArea: 60,
      landArea: null,
      bedrooms: 3,
      bathrooms: 2,
      livingRooms: 1,
      kitchens: 1,
      garageSpaces: 1,
      hasServiceArea: true,
    })
  })
})
