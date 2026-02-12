import { Command } from 'commander'
import ora from 'ora'
import type { z } from 'zod'
import type { OffersResponseSchema } from '@bidradar/shared'
import { parseFilter, parseSort, FilterParseError } from '@bidradar/shared'
import { apiRequest, ApiError } from '../lib/apiClient.js'
import { renderTable } from '../lib/formatTable.js'
import { displayWithPager } from '../lib/pager.js'

type OffersResponse = z.infer<typeof OffersResponseSchema>

export const query = new Command('query')
  .description('Query offers')
  .option('-f, --filter <expression>', 'OData-style filter expression')
  .option(
    '-s, --sort <expr>',
    'Sort expression (e.g. "uf asc, askingPrice desc")',
    'updatedAt desc',
  )
  .option('-l, --page-size <n>', 'Rows per page', '50')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-r, --include-removed', 'Include soft-deleted records', false)
  .option('-c, --columns <cols>', 'Comma-separated column names to display')
  .option('--no-pager', 'Disable pager (less) for output')
  .action(
    async (opts: {
      filter?: string
      sort: string
      pageSize: string
      page: string
      includeRemoved: boolean
      columns?: string
      pager: boolean
    }) => {
      const spinner = ora()
      try {
        // Client-side validation for fast feedback
        if (opts.filter) {
          try {
            parseFilter(opts.filter)
          } catch (err) {
            if (err instanceof FilterParseError) {
              console.error(`Filter syntax error: ${err.message}`)
              process.exitCode = 1
              return
            }
            throw err
          }
        }

        try {
          parseSort(opts.sort)
        } catch (err) {
          console.error(`Sort error: ${(err as Error).message}`)
          process.exitCode = 1
          return
        }

        spinner.start('Querying offers...')

        const queryParams: Record<string, string | undefined> = {
          filter: opts.filter,
          sort: opts.sort,
          pageSize: opts.pageSize,
          page: opts.page,
        }
        if (opts.includeRemoved) {
          queryParams['includeRemoved'] = 'true'
        }

        const result = await apiRequest<OffersResponse>('GET', '/offers', {
          query: queryParams,
        })

        spinner.succeed(
          `Found ${result.data.length} offer(s) (page ${String(result.pagination.page)}, total ${String(result.pagination.total)})`,
        )

        if (result.data.length === 0) {
          console.log('\nNo results match the given criteria.')
          return
        }

        const table = renderTable(result.data, opts.columns)

        if (opts.pager) {
          await displayWithPager(table)
        } else {
          console.log(table)
        }
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 401) {
          spinner.fail(
            'Not authenticated. Run `bidradar login` to authenticate.',
          )
        } else {
          spinner.fail(
            `Query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          )
        }
        process.exitCode = 1
      }
    },
  )
