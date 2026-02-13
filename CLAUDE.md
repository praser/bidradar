# Bidradar

Bidradar is a real estate offer aggregator that scrapes public listings from Brazilian government auctions (CEF/Caixa Economica Federal), reconciles them into a PostgreSQL database, and exposes them through a REST API with a CLI client.

## Architecture

pnpm monorepo with 4 library packages, 2 apps, and 1 infra package.

### Dependency graph

```
apps/api ──> @bidradar/core
         ──> @bidradar/api-contract
         ──> @bidradar/db
         ──> @bidradar/cef

apps/cli ──> @bidradar/core
         ──> @bidradar/api-contract

packages/api-contract ──> @bidradar/core
packages/db           ──> @bidradar/core
packages/cef          ──> @bidradar/core
packages/core         ──> (no workspace deps, only zod)
```

### Package responsibilities

| Package | Purpose |
|---|---|
| `packages/core` | Domain types (`Offer`, `User`, `AuthUser`, `PropertyDetails`), Zod schemas, repository interfaces, filter DSL parser, reconciliation logic |
| `packages/api-contract` | Shared Zod schemas for API request/response validation, sort parser |
| `packages/db` | Drizzle ORM schema, PostgreSQL repositories (offers, users, property details, auth sessions), filter-to-SQL translator |
| `packages/cef` | CEF CSV downloader and parser, converts raw CSV rows into domain `Offer` objects via Zod |
| `apps/api` | Hono HTTP server (also deployable as AWS Lambda), routes: auth (Google OAuth), offers, reconcile, users |
| `apps/cli` | Commander-based CLI: login, logout, whoami, query, reconcile commands. Bundled with tsup |
| `infra/aws` | SST v3 infrastructure: Lambda function URL with secrets |

### Key data flow

1. **Reconcile**: CEF CSV download -> parse -> compare with DB (find existing, classify new/updated/unchanged) -> batch insert/update/touch/soft-delete
2. **Query**: Filter DSL string -> tokenize -> parse AST -> translate to Drizzle SQL -> paginated query
3. **Auth**: CLI creates session -> browser opens Google OAuth -> callback writes JWT to session -> CLI polls for token

## Development

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 10.28.2 (corepack-managed)
- Docker (for PostgreSQL)

### Setup

```bash
cp .env.example .env     # Edit with real Google OAuth creds
pnpm install
docker compose up -d     # Start PostgreSQL
pnpm db:migrate          # Run Drizzle migrations
pnpm build               # Build all packages in dependency order
```

### Common commands

```bash
pnpm build               # Build all packages in topological order
pnpm dev:api             # Build deps + start API with hot reload (tsx watch)
pnpm dev:cli             # Run CLI in dev mode
pnpm db:up               # docker compose up -d
pnpm db:down             # docker compose down
pnpm db:generate         # Generate new Drizzle migration from schema changes
pnpm db:migrate          # Apply pending migrations
pnpm db:studio           # Open Drizzle Studio (port 4983)
```

### Building individual packages

Library packages export via `"exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }` and **must be built before consumers can use them**. The `pnpm build` root script handles this automatically in dependency order.

```bash
pnpm --filter @bidradar/core build
pnpm --filter @bidradar/api-contract build
pnpm --filter @bidradar/db build
pnpm --filter @bidradar/cef build
pnpm --filter @bidradar/api build
pnpm --filter @bidradar/cli build    # Uses tsup (bundles everything)
```

### Running the CLI locally

```bash
pnpm dev:cli -- login
pnpm dev:cli -- query -f "uf eq 'DF'"
pnpm dev:cli -- reconcile cef --uf DF
```

## Conventions

### TypeScript

- `exactOptionalPropertyTypes` is enabled -- never use `prop: value | undefined` for optional properties; use conditional assignment or separate objects instead
- `noUncheckedIndexedAccess` is enabled -- array/object indexing returns `T | undefined`
- `verbatimModuleSyntax` is enabled -- use `import type` for type-only imports
- All packages use `"module": "preserve"` and target ESNext
- Use `.js` extensions in relative imports (TypeScript module resolution)

### Zod

- Always use Zod for parsing external input (API requests, env vars, CSV rows, CLI args)
- Zod v4 is in use: `.default()` on transforms applies to the input type; place `.default()` before `.transform()`
- The project uses `zod` not `zod/v4` -- the monorepo is already on Zod v4

### Database

- Drizzle ORM with `postgres.js` driver
- Numeric columns (prices, percentages) are stored as `numeric` (string in Drizzle) -- convert with `Number()` on read, `String()` on write
- Schema lives in `packages/db/src/schema.ts`
- Migrations are in `packages/db/drizzle/` -- generated via `pnpm db:generate`
- Config in `packages/db/drizzle.config.ts` auto-loads `.env` from monorepo root

### Architecture patterns

- **Repository pattern**: `packages/core` defines interfaces (`OfferRepository`, `UserRepository`), `packages/db` implements them
- **Clean boundaries**: core has zero workspace deps; db and cef depend only on core; api-contract depends only on core; api composes everything
- **Factory functions**: Repositories are created via `createOfferRepository()`, `createUserRepository()`, etc.
- **Streaming**: Reconcile endpoint streams NDJSON progress events; CLI reads with async generator

### API

- Framework: Hono (works on both Node.js and AWS Lambda)
- Auth: Google OAuth -> HS256 JWT, verified via `jose`
- Middleware stack: `cors` -> `logger` -> `authenticate` (JWT) -> `authorize` (role check)
- Error responses follow `{ error: string, message: string, statusCode: number }` shape
- **CORS: The only API client is the CLI (runs on users' local machines, not a browser). CORS is irrelevant — never add CORS origin restrictions or `ALLOWED_ORIGINS` config. Keep `cors()` with no arguments. The API is protected by JWT auth, not CORS.**

### CLI

- Framework: Commander
- Bundled as single ESM file via tsup with shebang
- Config stored at `~/.bidradar/config.json`
- Uses `ora` for spinners, `cli-table3` for output, `less` for paging

## Key files

| File | Description |
|---|---|
| `packages/core/src/offer.ts` | `Offer` interface + `OfferSchema` |
| `packages/core/src/reconcile-offers.ts` | Core reconciliation algorithm |
| `packages/core/src/filter/parser.ts` | Filter DSL parser (recursive descent) |
| `packages/core/src/filter/types.ts` | Filter AST node types, field definitions |
| `packages/api-contract/src/api-contract.ts` | All API Zod schemas + sort parser |
| `packages/db/src/schema.ts` | Drizzle schema (offers, users, propertyDetails, authSessions) |
| `packages/db/src/offer-repository.ts` | Offer CRUD with batch operations |
| `packages/db/src/filter-to-drizzle.ts` | Filter AST -> Drizzle SQL WHERE clause |
| `packages/cef/src/CefOffer.ts` | CSV row -> Offer via Zod tuple transform |
| `apps/api/src/app.ts` | Hono app factory with route registration |
| `apps/api/src/routes/auth.ts` | Google OAuth flow (session/login/callback/token) |
| `apps/api/src/routes/reconcile.ts` | NDJSON streaming reconcile endpoint |
| `apps/api/src/lambda.ts` | AWS Lambda handler wrapper |
| `apps/cli/src/commands/query.ts` | Query command with filter/sort/pagination |
| `infra/aws/api.ts` | SST Lambda function URL definition |
| `sst.config.ts` | SST app config |

## Filter DSL

The query filter supports OData-like syntax:

```
uf eq 'DF'
askingPrice lt 500000 and discountPercent gt 30
city contains 'Brasilia' or city contains 'Goiania'
propertyType in ('Apartamento', 'Casa')
not (sellingType eq 'Leilao')
```

Fields: `uf`, `city`, `neighborhood`, `address`, `description`, `propertyType`, `sellingType` (text), `askingPrice`, `evaluationPrice`, `discountPercent` (numeric).

Operators: `eq`, `ne`, `gt`, `ge`, `lt`, `le`, `contains`, `startswith`, `endswith`, `in`.

## Infrastructure

- **Local**: Docker Compose (PostgreSQL 16, API container, Drizzle Studio)
- **AWS**: SST v3 with Lambda function URL (Node.js 22), secrets via SST Secret
- **IMPORTANT: The `aws.lambda.Permission("ApiPublicInvoke")` in `infra/aws/api.ts` with `action: "lambda:InvokeFunction"` and `principal: "*"` is REQUIRED. SST creates the function URL with AuthorizationType=NONE but does not add the resource-based policy. Without this permission the API returns 403 Forbidden. NEVER remove it.**
- **CI**: GitHub Actions -- build + typecheck on push/PR to main
- **Release**: Tag-triggered workflow -- CLI tarball + GitHub Release + Homebrew tap update + GHCR Docker image

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | HS256 signing key (min 32 chars) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ADMIN_EMAILS` | Comma-separated admin emails (auto-assigned admin role on first login) |
| `PORT` | API listen port (default 3000, local only) |
