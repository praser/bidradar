# Code Review

Review the provided code changes for quality, correctness, and adherence to project conventions.

## Checklist

### Type safety
- [ ] All external input is validated with Zod schemas
- [ ] `import type` used for type-only imports (`verbatimModuleSyntax`)
- [ ] No `body: value | undefined` patterns (`exactOptionalPropertyTypes`)
- [ ] Array/object indexing handles `T | undefined` (`noUncheckedIndexedAccess`)
- [ ] Relative imports use `.js` extensions

### Architecture
- [ ] `packages/core` has no workspace dependencies
- [ ] Repository pattern: interfaces in core, implementations in db
- [ ] New Zod schemas for API routes go in `packages/api-contract`
- [ ] Domain types and logic belong in `packages/core`

### Database
- [ ] Numeric values stored as strings in Drizzle, converted with `Number()`/`String()`
- [ ] New columns have appropriate types, constraints, and defaults
- [ ] Schema changes have corresponding Drizzle migrations

### API
- [ ] Error responses use `{ error, message, statusCode }` shape
- [ ] Protected routes use `authenticate` + optionally `authorize` middleware
- [ ] Input validated via Zod `.parse()` in route handlers

### Security
- [ ] No secrets in source code
- [ ] JWT claims validated properly
- [ ] SQL injection prevented (using Drizzle ORM, not raw queries)
- [ ] User input sanitized in filter DSL (LIKE patterns escaped)
