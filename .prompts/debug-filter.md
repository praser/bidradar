# Debug Filter DSL

Help debug a filter expression that is not working as expected.

## Context

The filter DSL is an OData-like expression language parsed by a recursive descent parser.

Pipeline: raw string -> `tokenize()` -> `Token[]` -> `parseFilter()` -> `FilterNode` AST -> `filterToDrizzle()` -> Drizzle SQL

## To debug

1. Read the user's filter expression
2. Mentally tokenize it and check for:
   - Unknown field names (valid: uf, city, neighborhood, address, description, propertyType, sellingType, askingPrice, evaluationPrice, discountPercent)
   - String-only operators on numeric fields (contains/startswith/endswith cannot be used with askingPrice, evaluationPrice, discountPercent)
   - Numeric values on text fields or vice versa
   - Missing quotes around string values (must use single quotes)
   - Unterminated string literals
   - Operator precedence issues (AND binds tighter than OR, use parentheses)
3. Parse the expression mentally to produce the AST
4. Explain what the generated SQL WHERE clause would look like
5. Suggest fixes

## Common mistakes

- Using `=` instead of `eq`
- Using double quotes instead of single quotes for strings
- Forgetting `and`/`or` between comparisons (no implicit AND)
- Case sensitivity: field names are camelCase, operators and keywords are lowercase
