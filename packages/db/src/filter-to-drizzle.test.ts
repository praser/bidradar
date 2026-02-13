import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FilterNode } from '@bidradar/core'

// Mock drizzle-orm before imports
vi.mock('drizzle-orm', () => {
  const eq = vi.fn((col, val) => ({ op: 'eq', col, val }))
  const ne = vi.fn((col, val) => ({ op: 'ne', col, val }))
  const gt = vi.fn((col, val) => ({ op: 'gt', col, val }))
  const gte = vi.fn((col, val) => ({ op: 'gte', col, val }))
  const lt = vi.fn((col, val) => ({ op: 'lt', col, val }))
  const lte = vi.fn((col, val) => ({ op: 'lte', col, val }))
  const ilike = vi.fn((col, val) => ({ op: 'ilike', col, val }))
  const inArray = vi.fn((col, vals) => ({ op: 'inArray', col, vals }))
  const and = vi.fn((...args) => ({ op: 'and', args }))
  const or = vi.fn((...args) => ({ op: 'or', args }))
  const not = vi.fn((arg) => ({ op: 'not', arg }))
  return { eq, ne, gt, gte, lt, lte, ilike, inArray, and, or, not }
})

vi.mock('./schema.js', () => ({
  offers: {
    uf: { name: 'uf' },
    city: { name: 'city' },
    neighborhood: { name: 'neighborhood' },
    address: { name: 'address' },
    description: { name: 'description' },
    propertyType: { name: 'propertyType' },
    sellingType: { name: 'sellingType' },
    askingPrice: { name: 'askingPrice' },
    evaluationPrice: { name: 'evaluationPrice' },
    discountPercent: { name: 'discountPercent' },
    updatedAt: { name: 'updatedAt' },
  },
}))

import { filterToDrizzle, SORT_COLUMN_MAP } from './filter-to-drizzle.js'
import { eq, ne, gt, gte, lt, lte, ilike, inArray, and, or, not } from 'drizzle-orm'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('filterToDrizzle', () => {
  describe('comparison nodes', () => {
    it('translates eq operator for text fields', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'uf',
        operator: 'eq',
        value: 'DF',
      }
      filterToDrizzle(node)
      expect(eq).toHaveBeenCalledWith({ name: 'uf' }, 'DF')
    })

    it('translates ne operator', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'city',
        operator: 'ne',
        value: 'Brasilia',
      }
      filterToDrizzle(node)
      expect(ne).toHaveBeenCalledWith({ name: 'city' }, 'Brasilia')
    })

    it('translates gt operator for numeric fields (converts to string)', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'askingPrice',
        operator: 'gt',
        value: 100000,
      }
      filterToDrizzle(node)
      expect(gt).toHaveBeenCalledWith({ name: 'askingPrice' }, '100000')
    })

    it('translates ge operator for numeric fields', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'evaluationPrice',
        operator: 'ge',
        value: 200000,
      }
      filterToDrizzle(node)
      expect(gte).toHaveBeenCalledWith({ name: 'evaluationPrice' }, '200000')
    })

    it('translates lt operator for numeric fields', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'discountPercent',
        operator: 'lt',
        value: 50,
      }
      filterToDrizzle(node)
      expect(lt).toHaveBeenCalledWith({ name: 'discountPercent' }, '50')
    })

    it('translates le operator', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'askingPrice',
        operator: 'le',
        value: 300000,
      }
      filterToDrizzle(node)
      expect(lte).toHaveBeenCalledWith({ name: 'askingPrice' }, '300000')
    })

    it('translates contains operator with ilike pattern', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'address',
        operator: 'contains',
        value: 'Asa Sul',
      }
      filterToDrizzle(node)
      expect(ilike).toHaveBeenCalledWith({ name: 'address' }, '%Asa Sul%')
    })

    it('translates startswith operator with ilike pattern', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'description',
        operator: 'startswith',
        value: 'Casa',
      }
      filterToDrizzle(node)
      expect(ilike).toHaveBeenCalledWith({ name: 'description' }, 'Casa%')
    })

    it('translates endswith operator with ilike pattern', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'description',
        operator: 'endswith',
        value: 'garagem',
      }
      filterToDrizzle(node)
      expect(ilike).toHaveBeenCalledWith({ name: 'description' }, '%garagem')
    })

    it('escapes LIKE special characters in contains', () => {
      const node: FilterNode = {
        type: 'comparison',
        field: 'address',
        operator: 'contains',
        value: '100% off_sale\\end',
      }
      filterToDrizzle(node)
      expect(ilike).toHaveBeenCalledWith(
        { name: 'address' },
        '%100\\% off\\_sale\\\\end%',
      )
    })
  })

  describe('in nodes', () => {
    it('translates in operator for text fields', () => {
      const node: FilterNode = {
        type: 'in',
        field: 'uf',
        values: ['DF', 'SP', 'RJ'],
      }
      filterToDrizzle(node)
      expect(inArray).toHaveBeenCalledWith({ name: 'uf' }, ['DF', 'SP', 'RJ'])
    })

    it('converts numeric field values to strings in "in" expressions', () => {
      const node: FilterNode = {
        type: 'in',
        field: 'askingPrice',
        values: [100000, 200000],
      }
      filterToDrizzle(node)
      expect(inArray).toHaveBeenCalledWith({ name: 'askingPrice' }, ['100000', '200000'])
    })
  })

  describe('logical nodes', () => {
    it('translates "and" node', () => {
      const node: FilterNode = {
        type: 'and',
        left: { type: 'comparison', field: 'uf', operator: 'eq', value: 'DF' },
        right: { type: 'comparison', field: 'city', operator: 'eq', value: 'Brasilia' },
      }
      filterToDrizzle(node)
      expect(and).toHaveBeenCalled()
    })

    it('translates "or" node', () => {
      const node: FilterNode = {
        type: 'or',
        left: { type: 'comparison', field: 'uf', operator: 'eq', value: 'DF' },
        right: { type: 'comparison', field: 'uf', operator: 'eq', value: 'SP' },
      }
      filterToDrizzle(node)
      expect(or).toHaveBeenCalled()
    })

    it('translates "not" node', () => {
      const node: FilterNode = {
        type: 'not',
        operand: { type: 'comparison', field: 'sellingType', operator: 'eq', value: 'Leilao' },
      }
      filterToDrizzle(node)
      expect(not).toHaveBeenCalled()
    })
  })
})

describe('SORT_COLUMN_MAP', () => {
  it('includes all filter fields plus updatedAt', () => {
    const expectedFields = [
      'uf', 'city', 'neighborhood', 'address', 'description',
      'propertyType', 'sellingType', 'askingPrice', 'evaluationPrice',
      'discountPercent', 'updatedAt',
    ]
    for (const field of expectedFields) {
      expect(SORT_COLUMN_MAP).toHaveProperty(field)
    }
  })
})
