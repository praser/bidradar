# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bidradar scrapes real estate auction offers from Caixa Econômica Federal (CEF), parses CSV data, and persists them to PostgreSQL with change tracking (versioning, soft deletes, last-seen timestamps).

## Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Run main workflow (tsx index.ts)
pnpm db:up                # Start PostgreSQL + Drizzle Studio via Docker
pnpm db:down              # Stop Docker services
pnpm db:generate          # Generate Drizzle migrations from schema changes
pnpm db:migrate           # Apply pending migrations
pnpm db:studio            # Open Drizzle Studio UI (port 4983)
```

No test framework is configured yet.

## Architecture

**Data flow:** CEF CSV endpoint → HTTP download (Latin-1→UTF-8) → stream-based CSV parsing → Zod validation → Drizzle ORM → PostgreSQL

### Source Layout

- **index.ts** — Orchestrator: fetches offers, diffs against DB, inserts/updates/soft-deletes
- **src/core/types.ts** — `Offer` interface and `GetOffers` function type shared across modules
- **src/cef/** — CEF data source: `getOffers()` downloads CSV, parses via `CefOffer` (Zod-validated class)
- **src/db/** — Drizzle ORM layer: `offers` table schema, lazy-initialized postgres connection (UTC)
- **src/cli/** — Commander-based CLI (in development)
- **drizzle/** — SQL migration files

### Key Conventions

- **ES Modules** throughout (`"type": "module"` in package.json); use `.js` extensions in imports even for `.ts` files
- **Strict TypeScript** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- **Zod v4** for runtime validation at data boundaries (CSV row → Offer)
- **Drizzle ORM** with postgres-js driver; schema lives in `src/db/schema.ts`
- **Node 22** (see `.nvmrc`); pnpm as package manager

### Database

- PostgreSQL 16 via Docker Compose; credentials in `.env` (see `.env.example`)
- `offers` table uses `sourceId` (unique, from CEF) as the business key
- Change tracking: `version` (incremented on field changes), `updatedAt`, `lastSeenAt`, `removedAt` (soft delete)
- Numeric fields (`askingPrice`, `evaluationPrice`, `discountPercent`) stored as `numeric` — converted to/from strings at the ORM boundary

### Data Source Details

- CSV endpoint: `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_{estate}.csv`
- Semicolon-delimited, Latin-1 encoded, first 4 rows skipped (metadata)
- Brazilian number format (e.g., `1.234.567,89`) normalized during parsing
- Browser-like HTTP headers required to avoid request blocking
