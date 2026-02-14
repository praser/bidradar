---
name: add-cli-command
description: Add a new command to the bidradar CLI application using Commander, ora spinners, and the API client. Use when extending the CLI with new user-facing commands.
---

# Add CLI Command

Add a new command to the bidradar CLI application.

## Steps

1. Create a new command file at `apps/cli/src/commands/<name>.ts`
2. Follow the existing pattern:
   ```typescript
   import { Command } from 'commander'
   import ora from 'ora'
   import { apiRequest, ApiError } from '../lib/apiClient.js'

   export const myCommand = new Command('name')
     .description('What it does')
     .option('-x, --example <value>', 'description')
     .action(async (opts) => {
       const spinner = ora()
       try {
         spinner.start('Doing something...')
         // ... call apiRequest or apiRequestStream
         spinner.succeed('Done')
       } catch (err) {
         if (err instanceof ApiError && err.statusCode === 401) {
           spinner.fail('Not authenticated. Run `bidradar login` to authenticate.')
         } else {
           spinner.fail(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
         }
         process.exitCode = 1
       }
     })
   ```
3. Register the command in `apps/cli/src/index.ts`:
   ```typescript
   import { myCommand } from './commands/name.js'
   program.addCommand(myCommand)
   ```
4. Build: `pnpm --filter @bidradar/cli build`
5. Test: `pnpm dev:cli -- <command-name> [args]`

## Important

- Always handle `ApiError` with 401 (not authenticated) and 403 (forbidden) cases
- Use `ora` spinners for any async operations
- Use Zod for any input validation
- The CLI is bundled by tsup -- all dependencies are inlined
- API client lives in `apps/cli/src/lib/apiClient.ts` (supports JSON and NDJSON streaming)
