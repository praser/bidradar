import Table from 'cli-table3'
import type { Offer } from '@bidradar/shared'

interface ColumnDef {
  key: keyof Offer
  header: string
  hAlign: 'left' | 'center' | 'right'
  format?: (value: unknown) => string
  maxWidth?: number
}

const formatBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatPercent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function truncate(value: unknown, max: number): string {
  const s = String(value)
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'ID', hAlign: 'left' },
  { key: 'uf', header: 'UF', hAlign: 'center' },
  { key: 'city', header: 'Cidade', hAlign: 'left' },
  { key: 'neighborhood', header: 'Bairro', hAlign: 'left' },
  { key: 'address', header: 'Endere\u00e7o', hAlign: 'left' },
  { key: 'sellingType', header: 'Modalidade', hAlign: 'left' },
  {
    key: 'askingPrice',
    header: 'Pre\u00e7o',
    hAlign: 'right',
    format: (v) => formatBRL.format(v as number),
  },
  {
    key: 'evaluationPrice',
    header: 'Avalia\u00e7\u00e3o',
    hAlign: 'right',
    format: (v) => formatBRL.format(v as number),
  },
  {
    key: 'discountPercent',
    header: 'Desconto',
    hAlign: 'right',
    format: (v) => formatPercent.format((v as number) / 100),
  },
  {
    key: 'description',
    header: 'Descri\u00e7\u00e3o',
    hAlign: 'left',
    maxWidth: 25,
  },
  { key: 'offerUrl', header: 'URL', hAlign: 'left' },
]

const DEFAULT_KEYS: (keyof Offer)[] = [
  'uf',
  'city',
  'sellingType',
  'askingPrice',
  'evaluationPrice',
  'discountPercent',
  'description',
]

const columnByKey = new Map(ALL_COLUMNS.map((c) => [c.key, c]))

export function resolveColumns(input?: string): ColumnDef[] {
  if (!input) {
    return DEFAULT_KEYS.map((k) => columnByKey.get(k)!)
  }

  const keys = input.split(',').map((s) => s.trim())
  const cols: ColumnDef[] = []
  for (const key of keys) {
    const col = columnByKey.get(key as keyof Offer)
    if (!col) {
      const valid = ALL_COLUMNS.map((c) => c.key).join(', ')
      throw new Error(`Unknown column "${key}". Valid columns: ${valid}`)
    }
    cols.push(col)
  }
  return cols
}

export function renderTable(offers: Offer[], columnKeys?: string): string {
  const cols = resolveColumns(columnKeys)

  const table = new Table({
    head: cols.map((c) => c.header),
    colAligns: cols.map((c) => c.hAlign),
    style: { head: [], border: [] },
  })

  for (const offer of offers) {
    const row = cols.map((col) => {
      const value = offer[col.key]
      if (col.format) return col.format(value)
      if (col.maxWidth) return truncate(value, col.maxWidth)
      return String(value)
    })
    table.push(row)
  }

  return table.toString()
}
