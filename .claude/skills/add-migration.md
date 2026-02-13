# Add Database Migration

Create a new Drizzle migration after schema changes.

## Steps

1. Read the current schema at `packages/db/src/schema.ts`
2. Make the requested schema changes
3. Build the db package: `pnpm --filter @bidradar/db build`
4. Generate the migration: `pnpm db:generate`
5. Review the generated SQL in `packages/db/drizzle/`
6. If the migration needs manual edits (data backfill, etc.), edit the SQL file directly
7. Test by running: `pnpm db:migrate`

## Important

- Numeric columns use `numeric(precision, scale)` -- Drizzle represents these as strings
- Always add `.notNull()` unless the column is intentionally nullable
- Timestamps should use `{ withTimezone: true }`
- Foreign keys use `.references(() => table.column)`
- After schema changes, rebuild consumers: `pnpm build`
