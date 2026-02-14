---
name: add-api-route
description: Add a new route to the Hono API server with Zod validation, middleware integration, and proper error handling patterns. Use when creating new API endpoints or extending the REST API.
---

# Add API Route

Add a new route to the Hono API server.

## Steps

1. Define Zod schemas for request params/query/body and response in `packages/api-contract/src/api-contract.ts`
2. Export them from `packages/api-contract/src/index.ts`
3. Create a route file at `apps/api/src/routes/<name>.ts` following the existing pattern:
   - Create a function that returns a `Hono` instance
   - Use Zod `.parse()` for all input validation (params, query, body)
   - Return typed JSON responses
4. Register the route in `apps/api/src/app.ts`:
   - Public routes: `app.route('/path', routes(env))`
   - Authenticated routes: add to the `authenticated` Hono instance
   - Admin-only routes: use `authorize('admin')` middleware inside the route file (see `management.ts` for pattern)
5. Build: `pnpm --filter @bidradar/api-contract build && pnpm --filter @bidradar/api build`

## Patterns

- Error responses: `c.json({ error: 'CODE', message: 'text', statusCode: N }, N)`
- Streaming: use `stream(c, async (s) => { ... })` with `application/x-ndjson`
- Route functions receive `env: Env` only if they need env vars; otherwise take no args
- Auth context: `c.get('user')` returns `AuthUser` on authenticated routes
- Use `type AuthEnv` from `middleware/authenticate.ts` for Hono generics
