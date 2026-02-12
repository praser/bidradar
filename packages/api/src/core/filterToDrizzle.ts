import { eq, ne, gt, gte, lt, lte, and, or, not, ilike, inArray, type SQL } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'
import { offers } from '../db/schema.js'
import type {
  FilterNode,
  FilterField,
  FilterValue,
  SortableField,
} from '@bidradar/shared'

const COLUMN_MAP: Record<FilterField, AnyColumn> = {
  uf: offers.uf,
  city: offers.city,
  neighborhood: offers.neighborhood,
  address: offers.address,
  description: offers.description,
  propertyType: offers.propertyType,
  sellingType: offers.sellingType,
  askingPrice: offers.askingPrice,
  evaluationPrice: offers.evaluationPrice,
  discountPercent: offers.discountPercent,
}

export const SORT_COLUMN_MAP: Record<SortableField, AnyColumn> = {
  ...COLUMN_MAP,
  updatedAt: offers.updatedAt,
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
      }
      break
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
