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
| `apps/api` | Hono HTTP server (also deployable as AWS Lambda), routes: auth (Google OAuth), offers, management (S3 upload URLs), users |
| `apps/cli` | Commander-based CLI: login, logout, whoami, query, manager (download/upload) commands. Bundled with tsup |
| `infra/aws` | SST v3 infrastructure: Lambda function URL with secrets |

### Key data flow

1. **Ingest**: CLI `manager download` fetches CEF CSV -> gets presigned S3 URL from API -> uploads to S3 -> processing Lambda parses CSV -> reconciles with DB (immutable versioned rows: insert new, insert updated with bumped version, insert soft-deleted)
2. **Query**: Filter DSL string -> tokenize -> parse AST -> translate to Drizzle SQL -> paginated query against `currentOffers` view (latest version per source ID)
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
pnpm test                # Run unit & integration tests
pnpm test:watch          # Run tests in watch mode
pnpm test:e2e            # Run E2E tests (requires local PostgreSQL)
pnpm test:e2e:live       # Run E2E tests against deployed staging Lambda
pnpm typecheck           # Typecheck all packages
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
pnpm dev:cli -- manager download offer-list
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
- **Immutable offers**: The `offers` table is append-only with versioned rows. Each reconcile inserts new rows (new, updated, soft-deleted). The `currentOffers` view returns the latest version per `sourceId`

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
| `packages/db/src/schema.ts` | Drizzle schema (downloadMetadata, offers, currentOffers view, users, propertyDetails, authSessions) |
| `packages/db/src/offer-repository.ts` | Offer CRUD with batch operations |
| `packages/db/src/filter-to-drizzle.ts` | Filter AST -> Drizzle SQL WHERE clause |
| `packages/cef/src/CefOffer.ts` | CSV row -> Offer via Zod tuple transform |
| `packages/core/src/cef-file.ts` | CEF file types, S3 key builder/parser, download URL builder |
| `packages/core/src/process-offers-file.ts` | Parses uploaded CSV buffer, groups by UF, reconciles per state |
| `apps/api/src/app.ts` | Hono app factory with route registration |
| `apps/api/src/routes/auth.ts` | Google OAuth flow (session/login/callback/token) |
| `apps/api/src/routes/management.ts` | Admin management routes (S3 presigned upload URL) |
| `apps/api/src/lambda.ts` | AWS Lambda handler wrapper |
| `apps/cli/src/commands/query.ts` | Query command with filter/sort/pagination |
| `apps/cli/src/commands/management.ts` | Manager command: download CEF files and upload to S3 |
| `infra/aws/api.ts` | SST Lambda function URL definition |
| `sst.config.ts` | SST app config |
| `.github/workflows/ci.yml` | CI pipeline (static checks, tests, E2E) |
| `.github/workflows/release.yml` | Release pipeline (version bump, deploy staging, E2E, deploy prod, publish) |
| `vitest.config.ts` | Unit/integration test config |
| `vitest.config.e2e.ts` | E2E test config (local PostgreSQL) |
| `vitest.config.e2e.live.ts` | E2E test config (live staging Lambda) |
| `apps/api/Dockerfile` | Multi-stage Docker build for API |
| `scripts/bump-version.mjs` | Semver bump from conventional commits (`--dry` for detection) |
| `scripts/generate-changelog.mjs` | Changelog generation from conventional commits |

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
- **AWS**: SST v3 with Lambda function URL (Node.js 22), secrets via SST Secret, API URLs stored in SSM Parameter Store (`/bidradar/{env}/api-url`)
- **IMPORTANT: The `aws.lambda.Permission("ApiPublicInvoke")` in `infra/aws/api.ts` with `action: "lambda:InvokeFunction"` and `principal: "*"` is REQUIRED. SST creates the function URL with AuthorizationType=NONE but does not add the resource-based policy. Without this permission the API returns 403 Forbidden. NEVER remove it.**
- **CI**: GitHub Actions -- static checks, unit/integration tests, E2E tests on push/PR to main (`.github/workflows/ci.yml`)
- **Release**: Automated on merge to main -- version bump from conventional commits, deploy to staging, E2E against staging, deploy to prod, CLI tarball + GitHub Release + Homebrew tap (`.github/workflows/release.yml`)

### Environments

Each environment is a fully independent SST stage with its own Lambda function, function URL, SQS queues, and database.

| Environment | SST stage | SSM parameter | Updated by |
|---|---|---|---|
| `staging` | `--stage staging` | `/bidradar/staging/api-url` | Automatic on merge to `main` |
| `prod` | `--stage prod` | `/bidradar/prod/api-url` | Automatic after staging E2E tests pass |
| Personal | `--stage <name>` | `/bidradar/<name>/api-url` | Manual deploy |

- SSM parameters are the single source of truth for API URLs — created by SST during deploy (`infra/aws/api.ts`)
- The release pipeline reads URLs from SSM after deploying each stage
- E2E live tests resolve the API URL via `DEV_API_URL` env var (override) or SSM parameter (default, using `BIDRADAR_ENV` to select environment, default `staging`)
- Rollback: redeploy a previous commit (`git checkout <tag> && npx sst deploy --stage prod`) or revert on main
- The CLI default API URL is baked in at build time via the `BIDRADAR_DEFAULT_API_URL` env var in `tsup.config.ts`. Release builds use the prod function URL; local dev defaults to `http://localhost:3000`
- GitHub environments (`staging` and `prod`) scope secrets (`DATABASE_URL`, `JWT_SECRET`, etc.) per stage

### Conventional commits

All commits to `main` must follow the [Conventional Commits](https://www.conventionalcommits.org/) format. The release pipeline uses commit messages to determine the semantic version bump automatically.

| Prefix | Bump | Example |
|---|---|---|
| `fix:` / `fix(scope):` | patch | `fix(db): handle null discount percent` |
| `feat:` / `feat(scope):` | minor | `feat(cli): add export command` |
| `BREAKING CHANGE:` / `type!:` | major | `feat!: rename filter field propertyType to type` |
| `chore:`, `docs:`, `refactor:`, `test:`, `ci:` | patch | `chore: update dependencies` |

### CI/CD

**CI pipeline** (`.github/workflows/ci.yml`) -- runs on push/PR to `main`:

1. **Static Checks** -- `pnpm build` + `pnpm typecheck`
2. **Unit & Integration Tests** -- `pnpm test --passWithNoTests` (needs Static Checks)
3. **E2E Tests** -- spins up PostgreSQL service, runs `pnpm test:e2e` (needs Static Checks; skipped on fork PRs)

**Release pipeline** (`.github/workflows/release.yml`) -- runs on push to `main`:

1. **Determine Version** -- runs `node scripts/bump-version.mjs --dry` to compute semver bump from conventional commits since last tag
2. **Static Checks & Tests** -- build, typecheck, unit tests
3. **Deploy to Staging** -- `npx sst deploy --stage staging`, runs migrations, captures staging URL
4. **E2E Tests (Staging)** -- runs `pnpm test:e2e:live` against the deployed staging stage
5. **Deploy to Prod** -- `npx sst deploy --stage prod`, runs migrations, captures prod URL
6. **Release** -- runs `scripts/bump-version.mjs` to bump all 7 `package.json` files, runs `scripts/generate-changelog.mjs` to update `CHANGELOG.md`, commits + tags, builds CLI with prod URL baked in, creates GitHub Release with CLI tarball (notes from `CHANGELOG.md`), updates Homebrew tap
7. **Report Failure** -- on failure, creates a GitHub issue with details of the failed step

Release commits (`chore(release): v*`) are detected and skipped to prevent infinite loops.

### Testing

**Test commands:**

```bash
pnpm test                # Unit & integration tests (packages/*/src + apps/*/src)
pnpm test:watch          # Unit tests in watch mode
pnpm test:e2e            # E2E tests against local PostgreSQL (e2e/**/*.test.ts)
pnpm test:e2e:live       # E2E tests against deployed dev Lambda (e2e/live/**/*.test.ts)
```

**Test file conventions:**

- Unit/integration tests: co-located with source as `*.test.ts` files (e.g., `packages/db/src/filter-to-drizzle.test.ts`)
- E2E tests (local): `e2e/**/*.test.ts` -- require local PostgreSQL via Docker Compose
- E2E tests (live): `e2e/live/**/*.test.ts` -- require `DEV_API_URL` env var or SSM parameter pointing to deployed staging API
- Framework: Vitest (config files: `vitest.config.ts`, `vitest.config.e2e.ts`, `vitest.config.e2e.live.ts`)

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | HS256 signing key (min 32 chars) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ADMIN_EMAILS` | Comma-separated admin emails (auto-assigned admin role on first login) |
| `PORT` | API listen port (default 3000, local only) |
| `BUCKET_NAME` | S3 bucket name for CEF file uploads (set automatically by SST via `link`) |
| `BIDRADAR_DEFAULT_API_URL` | Default API URL baked into CLI at build time (tsup `env`). Release builds set this to the prod function URL |
| `DEV_API_URL` | API URL for E2E live tests (takes precedence over SSM lookup) |
| `BIDRADAR_ENV` | Environment name for SSM parameter lookup in E2E live tests (default `staging`) |
