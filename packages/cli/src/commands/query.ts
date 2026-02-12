import { Command } from 'commander'
import ora from 'ora'
import type { z } from 'zod'
import type { OffersResponseSchema } from '@bidradar/shared'
import { apiRequest, ApiError } from '../lib/apiClient.js'
import { renderTable } from '../lib/formatTable.js'
import { displayWithPager } from '../lib/pager.js'

type OffersResponse = z.infer<typeof OffersResponseSchema>

export const query = new Command('query')
  .description('Query offers')
  .option('-u, --uf <code>', 'Filter by Brazilian state')
  .option('-c, --city <name>', 'Filter by city')
  .option('-t, --selling-type <type>', 'Filter by selling type')
  .option('--min-price <n>', 'Minimum asking price')
  .option('--max-price <n>', 'Maximum asking price')
  .option(
    '-s, --sort <field>',
    'Sort order (price_asc, updated_desc)',
    'updated_desc',
  )
  .option('-l, --page-size <n>', 'Rows per page', '50')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-r, --include-removed', 'Include soft-deleted records', false)
  .option('--columns <cols>', 'Comma-separated column names to display')
  .option('--no-pager', 'Disable pager (less) for output')
  .action(
    async (opts: {
      uf?: string
      city?: string
      sellingType?: string
      minPrice?: string
      maxPrice?: string
      sort: string
      pageSize: string
      page: string
      includeRemoved: boolean
      columns?: string
      pager: boolean
    }) => {
      const spinner = ora()
      try {
        spinner.start('Querying offers...')

        const result = await apiRequest<OffersResponse>('GET', '/offers', {
          query: {
            uf: opts.uf,
            city: opts.city,
            sellingType: opts.sellingType,
            minPrice: opts.minPrice,
            maxPrice: opts.maxPrice,
            sort: opts.sort,
            pageSize: opts.pageSize,
            page: opts.page,
            includeRemoved: opts.includeRemoved ? 'true' : undefined,
          },
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
