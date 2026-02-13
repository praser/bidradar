---
name: add-filter-field
description: Add a new field to the filter DSL so users can filter and sort offers by it in queries. Use when extending the query capabilities with new filterable or sortable fields.
---

# Add Filter Field

Add a new field to the filter DSL so users can filter and sort by it.

## Steps

1. **Core types** (`packages/core/src/filter/types.ts`):
   - Add the field name to `TEXT_FIELDS` or `NUMERIC_FIELDS` array
   - This automatically includes it in `FILTER_FIELDS` and `FilterField` type

2. **Sort support** (if sortable):
   - Add to `SORTABLE_FIELDS` in the same file (it already spreads `FILTER_FIELDS`)
   - Or add it manually if it is sortable but not filterable

3. **DB column mapping** (`packages/db/src/filter-to-drizzle.ts`):
   - Add the mapping in `COLUMN_MAP` (field name -> Drizzle column)
   - If sortable, it auto-inherits into `SORT_COLUMN_MAP`

4. **Ensure DB schema** (`packages/db/src/schema.ts`):
   - The field must correspond to a column on the `offers` table (or a joined table)

5. **Build and verify**:
   ```bash
   pnpm --filter @bidradar/core build
   pnpm --filter @bidradar/db build
   pnpm build
   ```

## How the filter DSL works

The filter pipeline is: raw string -> `tokenize()` -> `Token[]` -> `parseFilter()` -> `FilterNode` AST -> `filterToDrizzle()` -> Drizzle `SQL`.

- Tokenizer recognizes field names from `FILTER_FIELDS` set
- Parser validates type compatibility (string ops on text fields, numeric ops on numeric fields)
- `filterToDrizzle` maps AST nodes to Drizzle operators using `COLUMN_MAP`
