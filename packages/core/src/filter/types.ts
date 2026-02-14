export const TEXT_FIELDS = [
  'uf',
  'city',
  'neighborhood',
  'address',
  'description',
  'propertyType',
  'sellingType',
] as const

export const NUMERIC_FIELDS = [
  'askingPrice',
  'evaluationPrice',
  'discountPercent',
] as const

export const FILTER_FIELDS = [...TEXT_FIELDS, ...NUMERIC_FIELDS] as const
export type FilterField = (typeof FILTER_FIELDS)[number]

export const SORTABLE_FIELDS = [...FILTER_FIELDS, 'createdAt'] as const
export type SortableField = (typeof SORTABLE_FIELDS)[number]

export type SortDirection = 'asc' | 'desc'

export interface SortClause {
  field: SortableField
  direction: SortDirection
}

export const COMPARISON_OPERATORS = [
  'eq',
  'ne',
  'gt',
  'ge',
  'lt',
  'le',
  'contains',
  'startswith',
  'endswith',
] as const
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number]

export const STRING_ONLY_OPERATORS = [
  'contains',
  'startswith',
  'endswith',
] as const
export type StringOnlyOperator = (typeof STRING_ONLY_OPERATORS)[number]

export type FilterValue = string | number

export interface ComparisonNode {
  type: 'comparison'
  field: FilterField
  operator: ComparisonOperator
  value: FilterValue
}

export interface InNode {
  type: 'in'
  field: FilterField
  values: FilterValue[]
}

export interface LogicalNode {
  type: 'and' | 'or'
  left: FilterNode
  right: FilterNode
}

export interface NotNode {
  type: 'not'
  operand: FilterNode
}

export type FilterNode = ComparisonNode | InNode | LogicalNode | NotNode
