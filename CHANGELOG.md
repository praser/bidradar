# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-02-13

### Features

- Add dual environments, automated release pipeline, and comprehensive test coverage (3d3799c)

### Bug Fixes

- Make secrets available for gh release action (5709e77)
- Chunk large batch operations to avoid PostgreSQL parameter limits (ed1c3e1)
- Remove indra/aws and infra/supabase from pnpm lock file (56e52be)
- Add SST type reference to infra config for proper type resolution (6472088)

### CI/CD

- Run CI workflow only on pull requests to main (e2c2289)

### Other

- Inject DEV_API_URL (ff09a65)
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
