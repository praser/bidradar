# Add Data Source

Add a new external data source (similar to the existing CEF package).

## Steps

1. Create a new package: `packages/<source>/`
   - `package.json` with `"type": "module"`, exports config, `@bidradar/core` dependency, and `zod`
   - `tsconfig.json` extending `../../tsconfig.base.json`
   - `src/index.ts` exporting the public API

2. Implement the data source:
   - Create a Zod schema for raw input parsing (see `packages/cef/src/CefOffer.ts`)
   - Implement a download/fetch function that returns a stream or raw data
   - Implement a parse function that converts raw data into `Offer[]` from `@bidradar/core`
   - Export a `getOffers: GetOffers` function following the `GetOffers` type signature

3. Add the source to the reconcile endpoint:
   - Add to `ReconcileParamsSchema` source enum in `packages/api-contract/src/api-contract.ts`
   - Add a new case in `apps/api/src/routes/reconcile.ts` switch statement
   - The reconcile logic (`reconcileOffers`) is source-agnostic -- just pass the parsed offers

4. Add CLI support:
   - Add a subcommand under `apps/cli/src/commands/reconcile.ts`

5. Build and register:
   - Add to `pnpm-workspace.yaml` if needed (already covers `packages/*`)
   - Run `pnpm install` to link the new package
   - `pnpm build` to build in order

## Patterns

- Use Zod tuples/transforms for CSV column parsing
- Stream large downloads to avoid memory issues (see `packages/cef/src/downloader.ts`)
- The `Offer` interface is the universal contract -- all sources must produce `Offer[]`
