# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bidradar scrapes real estate auction offers from Caixa Econômica Federal (CEF), parses CSV data, and persists them to PostgreSQL with change tracking (versioning, soft deletes, last-seen timestamps). The project is a pnpm monorepo with a clean architecture: pure domain core, pluggable infrastructure adapters, and thin application shells.

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm build                # Build all packages
pnpm dev:api              # Run API server in dev mode (tsx watch)
pnpm dev:cli              # Run CLI in dev mode (tsx)
pnpm db:up                # Start PostgreSQL + Drizzle Studio via Docker
pnpm db:down              # Stop Docker services
pnpm db:generate          # Generate Drizzle migrations from schema changes
pnpm db:migrate           # Apply pending migrations
pnpm db:studio            # Open Drizzle Studio UI (port 4983)
```

No test framework is configured yet.

## Architecture

**Monorepo structure** with four library packages and two application packages:

**Library packages** (`packages/`):
- **@bidradar/core** (`packages/core/`) — Pure domain: types, Zod schemas, business logic, filter parser. Zero workspace deps (only `zod`).
- **@bidradar/api-contract** (`packages/api-contract/`) — HTTP request/response Zod schemas, sort parser. Depends on `core`.
- **@bidradar/db** (`packages/db/`) — Drizzle ORM adapter: schema, connection, repository implementations, filter-to-SQL compiler. Depends on `core`.
- **@bidradar/cef** (`packages/cef/`) — CEF data source adapter: CSV download, Latin-1 decode, Zod validation. Depends on `core`.

**Application packages** (`apps/`):
- **@bidradar/api** (`apps/api/`) — Hono REST API composing all library packages. Handles auth, offers querying, and reconciliation.
- **@bidradar/cli** (`apps/cli/`) — Thin Commander-based CLI client. Communicates with the API via HTTP. Depends on `core` + `api-contract`.

**Infrastructure** (`infra/`):
- **@bidradar/infra-aws** (`infra/aws/`) — Future AWS CDK deployment (placeholder)
- **@bidradar/infra-supabase** (`infra/supabase/`) — Future Supabase config (placeholder)

**Dependency direction:**
```
            packages/core         <- zero workspace deps
           /      |       \
  api-contract   db       cef    <- each depends on core only
       \        / |      /
        apps/api  (all pkgs)     <- composes everything
        apps/cli  (core + api-contract)
```

**Data flow:** CEF CSV endpoint -> API (HTTP download -> Latin-1->UTF-8 -> CSV parsing -> Zod validation -> Drizzle ORM -> PostgreSQL) -> CLI (HTTP client)

### Source Layout

```
packages/
  core/src/
    offer.ts              — Offer interface + OfferSchema
    auth.ts               — Role enum, AuthUser type + schemas
    user.ts               — User domain interface
    property-details.ts   — PropertyDetails interface
    parse-description.ts  — parseDescription() pure function
    offer-repository.ts   — OfferRepository interface
    user-repository.ts    — UserRepository interface
    reconcile-offers.ts   — reconcileOffers() business logic
    filter/               — Filter AST types, tokenizer, parser
    index.ts              — Barrel export

  api-contract/src/
    api-contract.ts       — All endpoint Zod schemas + parseSort()
    index.ts

  db/src/
    schema.ts             — PostgreSQL schema (offers, users, propertyDetails)
    connection.ts         — getDb(), closeDb(), getRawClient()
    offer-repository.ts   — OfferRepository Drizzle implementation
    user-repository.ts    — UserRepository Drizzle implementation
    property-details-repository.ts
    filter-to-drizzle.ts  — FilterNode AST -> Drizzle SQL compiler
    index.ts
    drizzle.config.ts     — Drizzle Kit configuration
    drizzle/              — Generated migrations

  cef/src/
    downloader.ts         — CSV download (Latin-1 -> UTF-8)
    CefOffer.ts           — Zod schema + transform for CSV rows
    index.ts              — parseOffers(), downloadFile()

apps/
  api/src/
    index.ts              — Server entry point (@hono/node-server)
    app.ts                — Hono app factory composing routes + middleware
    env.ts                — Zod-validated environment config
    routes/               — API routes (auth, offers, reconcile, users)
    middleware/            — JWT authentication, role authorization, error handler
    scripts/              — backfillPropertyDetails

  cli/src/
    index.ts              — Commander setup
    commands/             — login, logout, reconcile, query, whoami
    lib/                  — API client, config storage (~/.bidradar/), pager, table formatter
```

### Key Conventions

- **ES Modules** throughout (`"type": "module"` in package.json); use `.js` extensions in imports even for `.ts` files
- **Strict TypeScript** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- **Zod v4** for runtime validation at data boundaries
- **Drizzle ORM** with postgres-js driver; schema + config + migrations all in `packages/db/`
- **Hono** as the API framework with `@hono/node-server`
- **jose** for JWT creation/verification (ESM-native, pure JS)
- **Node 22** (see `.nvmrc`); pnpm as package manager
- Workspace packages reference each other via `workspace:*` protocol
- Library packages use dist-based exports (`"types"` + `"default"`) — must be built before consumers can import them

### Database

- PostgreSQL 16 via Docker Compose; credentials in `.env` (see `.env.example`)
- **offers** table: uses `sourceId` (unique, from CEF) as the business key
  - Change tracking: `version`, `updatedAt`, `lastSeenAt`, `removedAt` (soft delete)
  - Numeric fields stored as `numeric` — converted to/from strings at the ORM boundary
- **users** table: Google OAuth users with roles (`admin`, `free`)
  - Unique constraints on `email` and `google_id`
  - Default role: `free`; admin emails configured via `ADMIN_EMAILS` env var

### Authentication & Authorization

- Google OAuth via Authorization Code flow (CLI opens browser -> localhost callback)
- API exchanges auth code for Google ID token, verifies, issues JWT (7-day expiry, HS256)
- CLI stores JWT in `~/.bidradar/config.json`
- Roles: `admin` (can reconcile), `free` (can query)
- `ADMIN_EMAILS` env var: comma-separated emails auto-assigned `admin` on first login

### API Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | /health | None | — | Health check |
| POST | /auth/session | None | — | Start OAuth login session |
| GET | /auth/login | None | — | Redirect to Google OAuth |
| GET | /auth/callback | None | — | Google OAuth callback |
| GET | /auth/token | None | — | Poll for JWT after login |
| GET | /offers | JWT | any | Query offers with structured filters |
| POST | /reconcile/:source | JWT | admin | Trigger CEF reconciliation |
| GET | /users/me | JWT | any | Current user info |

### Data Source Details

- CSV endpoint: `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_{estate}.csv`
- Semicolon-delimited, Latin-1 encoded, first 4 rows skipped (metadata)
- Brazilian number format (e.g., `1.234.567,89`) normalized during parsing
- Browser-like HTTP headers required to avoid request blocking
