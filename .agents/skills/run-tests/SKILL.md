---
name: run-tests
description: Run the bidradar test suites (unit, E2E local, E2E live) and understand test conventions. Use when running tests, adding new tests, or debugging test failures.
---

# Run Tests

Run the bidradar test suites and add new tests.

## Test suites

| Suite | Command | Config | What it tests |
|---|---|---|---|
| Unit | `pnpm test` | `vitest.config.ts` | Pure logic in packages and apps |
| Unit (watch) | `pnpm test:watch` | `vitest.config.ts` | Same, with file watching |
| E2E (local) | `pnpm test:e2e` | `vitest.config.e2e.ts` | API routes against local Docker DB |
| E2E (live) | `pnpm test:e2e:live` | `vitest.config.e2e.live.ts` | CLI against live dev Lambda |

### Unit tests

```bash
pnpm test                          # Run all unit tests once
pnpm test:watch                    # Run with file watching
pnpm test -- --reporter=verbose    # Verbose output
pnpm test -- packages/core         # Run only core package tests
```

Unit tests are co-located with source files: `<name>.test.ts` next to `<name>.ts`.

**Include pattern**: `packages/*/src/**/*.test.ts`, `apps/*/src/**/*.test.ts`

### E2E tests (local)

```bash
pnpm db:up                         # Ensure PostgreSQL is running
pnpm db:migrate                    # Apply migrations
pnpm test:e2e                      # Run E2E tests
```

E2E tests live in the `e2e/` directory at the repo root. They test API routes by starting a local Hono server against a real PostgreSQL database.

**Config**: `vitest.config.e2e.ts` -- 30s timeout, sequential execution (no parallelism).

### E2E tests (live)

```bash
pnpm test:e2e:live                 # Run against dev Lambda
```

These test the real CLI binary against the deployed `staging` Lambda environment.

## Test file conventions

### Unit tests

- File name: `<module>.test.ts` (co-located with source)
- Framework: Vitest (`describe`, `it`, `expect`)
- No external dependencies (database, network) -- use mocks/stubs

Example locations:
```
packages/core/src/filter/parser.test.ts
packages/core/src/reconcile-offers.test.ts
packages/api-contract/src/api-contract.test.ts
packages/cef/src/CefOffer.test.ts
apps/api/src/middleware/authenticate.test.ts
apps/cli/src/lib/config.test.ts
```

### E2E tests

- File name: `<feature>.test.ts` in `e2e/` directory
- Shared helpers: `e2e/helpers.ts`
- Database setup: `e2e/db-setup.ts`
- Tests run sequentially (no `fileParallelism`)

Example locations:
```
e2e/health.test.ts
e2e/auth.test.ts
e2e/offers.test.ts
e2e/users.test.ts
e2e/error-handling.test.ts
e2e/live/health.test.ts
e2e/live/auth.test.ts
e2e/live/query.test.ts
e2e/live/cli.test.ts
e2e/live/error-handling.test.ts
```

## Adding a new unit test

1. Create `<module>.test.ts` next to the source file
2. Import from the module using relative paths with `.js` extension
3. Write tests using Vitest:

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from './my-module.js'

describe('myFunction', () => {
  it('should do the expected thing', () => {
    const result = myFunction('input')
    expect(result).toBe('expected')
  })
})
```

4. Run: `pnpm test`

## Adding a new E2E test

1. Create `e2e/<feature>.test.ts`
2. Use shared helpers from `e2e/helpers.ts` and `e2e/db-setup.ts`
3. Run: `pnpm test:e2e`

## CI integration

- **PR checks**: Unit tests run in CI after build + typecheck (`pnpm test --passWithNoTests`)
- **Release pipeline**: E2E tests can run against the deployed `staging` environment after deploy
