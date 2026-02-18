import { Command } from 'commander'
import ora from 'ora'
import Table from 'cli-table3'
import type { z } from 'zod'
import type {
  CreateApiKeyResponseSchema,
  ListApiKeysResponseSchema,
  RevokeApiKeyResponseSchema,
} from '@bidradar/api-contract'
import { apiRequest, ApiError } from '../lib/apiClient.js'

type CreateApiKeyResponse = z.infer<typeof CreateApiKeyResponseSchema>
type ListApiKeysResponse = z.infer<typeof ListApiKeysResponseSchema>
type RevokeApiKeyResponse = z.infer<typeof RevokeApiKeyResponseSchema>

export const apiKey = new Command('api-key').description('Manage API keys')

apiKey.action(() => {
  apiKey.help()
})

apiKey
  .command('create')
  .description('Create a new API key')
  .argument('<name>', 'Name for the API key')
  .action(async (name: string) => {
    const spinner = ora()
    try {
      spinner.start('Creating API key...')
      const result = await apiRequest<CreateApiKeyResponse>(
        'POST',
        '/api-keys',
        { body: { name } },
      )
      spinner.succeed('API key created successfully')

      console.log()
      console.log(`  Name:   ${result.name}`)
      console.log(`  Prefix: ${result.keyPrefix}`)
      console.log(`  Key:    ${result.key}`)
      console.log()
      console.log(
        '  WARNING: This is the only time the full key will be displayed.',
      )
      console.log('  Save it in a secure location.')
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        spinner.fail(
          'Not authenticated. Run `bidradar login` to authenticate.',
        )
      } else {
        spinner.fail(
          `Failed to create API key: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
        process.exitCode = 1
      }
    }
  })

apiKey
  .command('list')
  .description('List all API keys')
  .action(async () => {
    const spinner = ora()
    try {
      spinner.start('Fetching API keys...')
      const result = await apiRequest<ListApiKeysResponse>(
        'GET',
        '/api-keys',
      )
      spinner.succeed(`Found ${String(result.keys.length)} API key(s)`)

      if (result.keys.length === 0) {
        console.log('\nNo API keys found.')
        return
      }

      const table = new Table({
        head: ['Name', 'Prefix', 'Created', 'Last Used', 'Status'],
      })

      for (const key of result.keys) {
        const status = key.revokedAt ? 'revoked' : 'active'
        table.push([
          key.name,
          key.keyPrefix,
          key.createdAt,
          key.lastUsedAt ?? 'never',
          status,
        ])
      }

      console.log(table.toString())
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        spinner.fail(
          'Not authenticated. Run `bidradar login` to authenticate.',
        )
      } else {
        spinner.fail(
          `Failed to list API keys: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
        process.exitCode = 1
      }
    }
  })

apiKey
  .command('revoke')
  .description('Revoke an API key')
  .argument('<name>', 'Name of the API key to revoke')
  .action(async (name: string) => {
    const spinner = ora()
    try {
      spinner.start('Revoking API key...')
      const result = await apiRequest<RevokeApiKeyResponse>(
        'DELETE',
        `/api-keys/${encodeURIComponent(name)}`,
      )

      if (result.revoked) {
        spinner.succeed('API key revoked successfully')
      } else {
        spinner.warn('API key was already revoked')
      }
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        spinner.fail(
          'Not authenticated. Run `bidradar login` to authenticate.',
        )
      } else {
        spinner.fail(
          `Failed to revoke API key: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
        process.exitCode = 1
      }
    }
  })
