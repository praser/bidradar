# Write Test

Write tests for bidradar code.

## Guidelines

- Use the native Node.js test runner (`node:test`) with `node:assert`
- Test files go next to source files or in a `__tests__/` directory
- Name test files `*.test.ts`

## What to test

### Core package (pure logic, no dependencies)
- Filter tokenizer: valid tokens, error cases, edge cases
- Filter parser: valid expressions, operator validation, nesting limits
- `parseDescription`: various description strings -> PropertyDetails
- `reconcileOffers`: mock the OfferRepository to test classification logic

### API contract
- `parseSort`: valid sort expressions, invalid fields, invalid directions
- Zod schemas: valid and invalid payloads

### DB package (needs database or mocks)
- `filterToDrizzle`: verify generated SQL for various AST nodes
- Repository methods: test with a real test database or mock Drizzle

### API routes (integration)
- Use Hono's test client: `app.request('/path', { method: 'GET', headers: {...} })`
- Test auth flow with mocked Google OAuth
- Test error responses for invalid input

### CLI commands
- Test command parsing and option validation
- Mock API calls to test output formatting

## Example test structure

```typescript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

describe('myFunction', () => {
  it('should handle the basic case', () => {
    const result = myFunction(input)
    assert.deepStrictEqual(result, expected)
  })

  it('should throw on invalid input', () => {
    assert.throws(() => myFunction(badInput), /expected error message/)
  })
})
```
