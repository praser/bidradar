import { Command } from 'commander'
import ora from 'ora'
import { getRawClient, closeDb } from '../../db/index'

interface QueryOpts {
  fields: string
  where?: string
  group?: string
  sort?: string
  pageSize: string
  page: string
  includeRemoved: boolean
}

function validateInput(value: string, name: string): void {
  if (value.includes(';')) {
    throw new Error(`Invalid ${name}: semicolons are not allowed`)
  }
}

function buildQuery(opts: QueryOpts): { sql: string; pageSize: number; page: number } {
  const pageSize = Math.max(1, Math.min(1000, Number(opts.pageSize) || 50))
  const page = Math.max(1, Number(opts.page) || 1)
  const offset = (page - 1) * pageSize

  validateInput(opts.fields, '--fields')
  if (opts.where) validateInput(opts.where, '--where')
  if (opts.group) validateInput(opts.group, '--group')
  if (opts.sort) validateInput(opts.sort, '--sort')

  const parts: string[] = []
  parts.push(`SELECT ${opts.fields} FROM offers`)

  const conditions: string[] = []
  if (!opts.includeRemoved) {
    conditions.push('removed_at IS NULL')
  }
  if (opts.where) {
    conditions.push(opts.where)
  }
  if (conditions.length > 0) {
    parts.push(`WHERE ${conditions.join(' AND ')}`)
  }

  if (opts.group) {
    parts.push(`GROUP BY ${opts.group}`)
  }
  if (opts.sort) {
    parts.push(`ORDER BY ${opts.sort}`)
  }

  parts.push(`LIMIT ${pageSize}`)
  if (offset > 0) {
    parts.push(`OFFSET ${offset}`)
  }

  return { sql: parts.join(' '), pageSize, page }
}

export const query = new Command('query')
  .description('Query offers with SQL-like options')
  .option('-f, --fields <expr>', 'SELECT columns/expressions', '*')
  .option('-w, --where <expr>', 'WHERE clause')
  .option('-g, --group <expr>', 'GROUP BY clause')
  .option('-s, --sort <expr>', 'ORDER BY clause')
  .option('-l, --page-size <n>', 'Rows per page', '50')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-r, --include-removed', 'Include soft-deleted records', false)
  .action(async (opts: QueryOpts) => {
    const spinner = ora()
    try {
      const { sql, pageSize, page } = buildQuery(opts)

      spinner.start('Querying database...')
      const client = getRawClient()
      const rows = await client.begin('READ ONLY', (tx) => tx.unsafe(sql))
      spinner.succeed(`Found ${rows.length} row(s) (page ${page}, page size ${pageSize})`)

      if (rows.length === 0) {
        console.log('\nNo results match the given criteria.')
        return
      }

      console.log()
      console.table(rows)
    } catch (err) {
      spinner.fail(err instanceof Error ? err.message : 'Query failed')
      process.exitCode = 1
    } finally {
      await closeDb()
    }
  })
