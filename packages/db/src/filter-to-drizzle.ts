import { eq, ne, gt, gte, lt, lte, and, or, not, ilike, inArray, type SQL } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'
import { currentOffers } from './schema.js'
import type {
  FilterNode,
  FilterField,
  FilterValue,
  SortableField,
} from '@bidradar/core'

const COLUMN_MAP: Record<FilterField, AnyColumn> = {
  uf: currentOffers.uf,
  city: currentOffers.city,
  neighborhood: currentOffers.neighborhood,
  address: currentOffers.address,
  description: currentOffers.description,
  propertyType: currentOffers.propertyType,
  sellingType: currentOffers.sellingType,
  askingPrice: currentOffers.askingPrice,
  evaluationPrice: currentOffers.evaluationPrice,
  discountPercent: currentOffers.discountPercent,
}

export const SORT_COLUMN_MAP: Record<SortableField, AnyColumn> = {
  ...COLUMN_MAP,
  createdAt: currentOffers.createdAt,
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function toColumnValue(field: FilterField, value: FilterValue): string | number {
  // Numeric columns are stored as `numeric` (string in Drizzle) — pass as string
  if (field === 'askingPrice' || field === 'evaluationPrice' || field === 'discountPercent') {
    return String(value)
  }
  return value as string
}

export function filterToDrizzle(node: FilterNode): SQL {
  switch (node.type) {
    case 'comparison': {
      const col = COLUMN_MAP[node.field]
      const val = toColumnValue(node.field, node.value)

      switch (node.operator) {
        case 'eq': return eq(col, val)
        case 'ne': return ne(col, val)
        case 'gt': return gt(col, val)
        case 'ge': return gte(col, val)
        case 'lt': return lt(col, val)
        case 'le': return lte(col, val)
        case 'contains': return ilike(col, `%${escapeLike(val as string)}%`)
        case 'startswith': return ilike(col, `${escapeLike(val as string)}%`)
        case 'endswith': return ilike(col, `%${escapeLike(val as string)}`)
        default: {
          const _exhaustive: never = node.operator
          throw new Error(`Unknown operator: ${String(_exhaustive)}`)
        }
      }
    }
    case 'in': {
      const col = COLUMN_MAP[node.field]
      const vals = node.values.map((v) => toColumnValue(node.field, v))
      return inArray(col, vals)
    }
    case 'and':
      return and(filterToDrizzle(node.left), filterToDrizzle(node.right))!
    case 'or':
      return or(filterToDrizzle(node.left), filterToDrizzle(node.right))!
    case 'not':
      return not(filterToDrizzle(node.operand))
  }
}
