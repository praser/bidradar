# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-02-14

### Features

- Make offers table immutable with download tracking (bc7d277)
- Add random suffix to downloaded offer list filename (532f593)
- Replace reconcile endpoint with scheduled update-cef-offers Lambda (b38961c)
- Store API URLs in SSM Parameter Store (59e4f82)
- Add dual environments, automated release pipeline, and comprehensive test coverage (3d3799c)

### Bug Fixes

- Bump from reachable tag, fall back to highest only on conflict (d74d35b)
- Use highest tag across all branches to prevent duplicate versions (1a1b485)
- Make secrets available for gh release action (5709e77)
- Chunk large batch operations to avoid PostgreSQL parameter limits (ed1c3e1)
- Remove indra/aws and infra/supabase from pnpm lock file (56e52be)
- Add SST type reference to infra config for proper type resolution (6472088)

### CI/CD

- Add local act runner and fix release workflow for act compatibility (3eb224c)
- Run CI workflow only on pull requests to main (e2c2289)

### Chores

- V0.1.0 (cc06a4e)

### Other

- Merge pull request #14 from praser/feat-sync-cef-offers (ebc7844)
- Update logic for calculing next version considering what already exstis in gh (b0aa3fa)
- Merge pull request #12 from praser/feat-sync-cef-offers (804a158)
- Merge pull request #10 from praser/release (866d26a)
- Merge pull request #4 from praser/release (0e25bfb)
- Inject DEV_API_URL (ff09a65)
- Merge pull request #3 from praser/release (f8a033d)
- Merge pull request #2 from praser/release (27cc027)
- Merge pull request #1 from praser/release (29911fc)
- Move skills to .agents and follow Agent Skills spec (47e10ad)
- Fine tunning of the project structure (14a8f95)
- Restore Lambda function URL permission and remove unused CORS config (36f1457)
- Harden security, add test suites, and set up CI/CD for release (f96ec92)
- Configure sst to deploy the app (0873ed5)
- Batch DB operations and stream reconcile progress via NDJSON (372a240)
- Move auth sessions from in-memory Map to PostgreSQL (0f22049)
- Restructure monorepo into clean architecture with explicit boundaries (f6c7046)
- Add property_details table parsed from offer descriptions (5355011)
- Add propertyType column to offers (9eb9932)
- Support multi-field sort with per-field direction (290f845)
- Replace individual query flags with OData-style --filter expression (b5f2a0f)
- Add tabular query output with horizontal scrolling (31dbb2e)
- Add a default value for uf when reconciling (870f64b)
- Remove config command from CLI (f3e3efa)
- Add logout command to clear stored credentials (ed6ea34)
- Move OAuth flow entirely to API with session-based polling (7637df1)
- Fix OAuth flow timeout not being cleared on completion (66104a7)
- Inject Google Client ID at build time via tsup define (8e463ab)
- Fix shared package exports to use compiled dist output (4de9ea5)
- Restructure into pnpm monorepo with REST API and CLI client (381ce88)

## [0.1.0] - 2026-02-14

### Features

- Replace reconcile endpoint with scheduled update-cef-offers Lambda (b38961c)
- Store API URLs in SSM Parameter Store (59e4f82)
- Add dual environments, automated release pipeline, and comprehensive test coverage (3d3799c)

### Bug Fixes

- Make secrets available for gh release action (5709e77)
- Chunk large batch operations to avoid PostgreSQL parameter limits (ed1c3e1)
- Remove indra/aws and infra/supabase from pnpm lock file (56e52be)
- Add SST type reference to infra config for proper type resolution (6472088)

### CI/CD

- Add local act runner and fix release workflow for act compatibility (3eb224c)
- Run CI workflow only on pull requests to main (e2c2289)

### Other

- Merge pull request #12 from praser/feat-sync-cef-offers (804a158)
- Merge pull request #10 from praser/release (866d26a)
- Merge pull request #4 from praser/release (0e25bfb)
- Inject DEV_API_URL (ff09a65)
- Merge pull request #3 from praser/release (f8a033d)
- Merge pull request #2 from praser/release (27cc027)
- Merge pull request #1 from praser/release (29911fc)
- Move skills to .agents and follow Agent Skills spec (47e10ad)
- Fine tunning of the project structure (14a8f95)
- Restore Lambda function URL permission and remove unused CORS config (36f1457)
- Harden security, add test suites, and set up CI/CD for release (f96ec92)
- Configure sst to deploy the app (0873ed5)
- Batch DB operations and stream reconcile progress via NDJSON (372a240)
- Move auth sessions from in-memory Map to PostgreSQL (0f22049)
- Restructure monorepo into clean architecture with explicit boundaries (f6c7046)
- Add property_details table parsed from offer descriptions (5355011)
- Add propertyType column to offers (9eb9932)
- Support multi-field sort with per-field direction (290f845)
- Replace individual query flags with OData-style --filter expression (b5f2a0f)
- Add tabular query output with horizontal scrolling (31dbb2e)
- Add a default value for uf when reconciling (870f64b)
- Remove config command from CLI (f3e3efa)
- Add logout command to clear stored credentials (ed6ea34)
- Move OAuth flow entirely to API with session-based polling (7637df1)
- Fix OAuth flow timeout not being cleared on completion (66104a7)
- Inject Google Client ID at build time via tsup define (8e463ab)
- Fix shared package exports to use compiled dist output (4de9ea5)
- Restructure into pnpm monorepo with REST API and CLI client (381ce88)
