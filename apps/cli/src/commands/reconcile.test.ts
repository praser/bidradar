import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

const ufSchema = z
  .string()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(BRAZILIAN_STATES))

describe('UF validation', () => {
  it('accepts valid uppercase state code', () => {
    expect(ufSchema.parse('DF')).toBe('DF')
    expect(ufSchema.parse('SP')).toBe('SP')
    expect(ufSchema.parse('RJ')).toBe('RJ')
  })

  it('accepts lowercase and normalizes to uppercase', () => {
    expect(ufSchema.parse('df')).toBe('DF')
    expect(ufSchema.parse('sp')).toBe('SP')
  })

  it('accepts mixed case', () => {
    expect(ufSchema.parse('Df')).toBe('DF')
  })

  it('rejects invalid state code', () => {
    expect(() => ufSchema.parse('XX')).toThrow()
    expect(() => ufSchema.parse('')).toThrow()
    expect(() => ufSchema.parse('BRAZIL')).toThrow()
  })

  it('validates all 27 Brazilian states', () => {
    for (const state of BRAZILIAN_STATES) {
      expect(ufSchema.parse(state)).toBe(state)
    }
    expect(BRAZILIAN_STATES).toHaveLength(27)
  })
})
