# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bidradar scrapes real estate auction offers from Caixa Econômica Federal (CEF), parses CSV data, and persists them to PostgreSQL with change tracking (versioning, soft deletes, last-seen timestamps). The project is a pnpm monorepo with a REST API and CLI client.

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

**Monorepo structure** with three packages:

- **@bidradar/shared** (`packages/shared/`) — Types, Zod schemas, API contracts shared between API and CLI
- **@bidradar/api** (`packages/api/`) — Hono REST API, sole database accessor. Handles auth, offers querying, and reconciliation
- **@bidradar/cli** (`packages/cli/`) — Thin Commander-based CLI client. Communicates with the API via HTTP. No database dependencies.

**Data flow:** CEF CSV endpoint → API (HTTP download → Latin-1→UTF-8 → CSV parsing → Zod validation → Drizzle ORM → PostgreSQL) → CLI (HTTP client)

### Source Layout

```
packages/
  shared/src/
    offer.ts          — Offer interface + Zod schema
    auth.ts           — Role enum, AuthUser type + schema
    api-contract.ts   — Zod schemas for all API request/response shapes
    index.ts          — Barrel export

  api/src/
    index.ts          — Server entry point (@hono/node-server)
    app.ts            — Hono app factory composing routes + middleware
    env.ts            — Zod-validated environment config
    core/             — Business logic (reconcileOffers, OfferRepository interface)
    cef/              — CEF data source (CSV download, parse, Zod validation)
    db/               — Drizzle ORM (schema, connection, offer + user repositories)
    routes/           — API routes (auth, offers, reconcile, users)
    middleware/       — JWT authentication, role authorization, error handler

  cli/src/
    index.ts          — Commander setup
    commands/         — login, reconcile, query, whoami, config
    lib/              — API client, config storage (~/.bidradar/), OAuth flow
```

### Key Conventions

- **ES Modules** throughout (`"type": "module"` in package.json); use `.js` extensions in imports even for `.ts` files
- **Strict TypeScript** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- **Zod v4** for runtime validation at data boundaries
- **Drizzle ORM** with postgres-js driver; schema lives in `packages/api/src/db/schema.ts`
- **Hono** as the API framework with `@hono/node-server`
- **jose** for JWT creation/verification (ESM-native, pure JS)
- **Node 22** (see `.nvmrc`); pnpm as package manager
- Workspace packages reference each other via `workspace:*` protocol

### Database

- PostgreSQL 16 via Docker Compose; credentials in `.env` (see `.env.example`)
- **offers** table: uses `sourceId` (unique, from CEF) as the business key
  - Change tracking: `version`, `updatedAt`, `lastSeenAt`, `removedAt` (soft delete)
  - Numeric fields stored as `numeric` — converted to/from strings at the ORM boundary
- **users** table: Google OAuth users with roles (`admin`, `free`)
  - Unique constraints on `email` and `google_id`
  - Default role: `free`; admin emails configured via `ADMIN_EMAILS` env var

### Authentication & Authorization

- Google OAuth via Authorization Code flow (CLI opens browser → localhost callback)
- API exchanges auth code for Google ID token, verifies, issues JWT (7-day expiry, HS256)
- CLI stores JWT in `~/.bidradar/config.json`
- Roles: `admin` (can reconcile), `free` (can query)
- `ADMIN_EMAILS` env var: comma-separated emails auto-assigned `admin` on first login

### API Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | /health | None | — | Health check |
| POST | /auth/google | None | — | Exchange Google OAuth code for JWT |
| GET | /offers | JWT | any | Query offers with structured filters |
| POST | /reconcile/:source | JWT | admin | Trigger CEF reconciliation |
| GET | /users/me | JWT | any | Current user info |

### Data Source Details

- CSV endpoint: `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_{estate}.csv`
- Semicolon-delimited, Latin-1 encoded, first 4 rows skipped (metadata)
- Brazilian number format (e.g., `1.234.567,89`) normalized during parsing
- Browser-like HTTP headers required to avoid request blocking
