# Changelog

All notable changes to this project will be documented in this file.

## [0.6.2] - 2026-02-20

### Features

- Add hourly EventBridge schedule for CEF file downloads (0da8aa0)

### Other

- Merge pull request #28 from praser/patch-auto-download-files (bd241a1)
- Remove .env.example file and update setup instructions in CLAUDE.md to reflect the change. (d946b23)

## [0.6.1] - 2026-02-20

### Refactoring

- Determine version bump from branch name instead of commits (63f7554)

### Other

- Merge pull request #27 from praser/chore-tagging (9d3d1dc)
- Stop triggering CI pipeline after mergin a PR (1b6bc88)

## [0.6.0] - 2026-02-20

### Features

- Load env vars from SSM instead of .env files (e731ed0)
- Support --stage flag in db:migrate, db:generate, and db:studio scripts (9f42acd)
- Load app config from SSM instead of local env file (4e040e3)
- Add worker infrastructure with API key auth and IAM provisioning (d10e25f)
- Centralize environment variables in SSM Parameter Store (fa134e8)
- Load .env.worker file automatically (23000a7)
- Add br_ prefix to generated API keys (3d9ba67)
- Revoke by name instead of id, enforce unique name per user (46f0fd8)

### Bug Fixes

- Pass AWS credentials as env vars for act compatibility (a389e42)
- Set non-zero exit code on query errors (b45e3cc)
- Support local act runner by skipping GitHub-only steps (2a9b0c6)
- Remove --stage flag from pnpm build and bake staging URL into CLI (3639afa)
- Sync pnpm-lock.yaml after removing @bidradar/cef from cli (f1f5b3b)
- Address release readiness findings (H1-H3, M1-M6, M8-M10, L1, L6) (4e4cb04)
- Set Referer header and user agent for browser fetching (47a9197)
- Resolve Chromium compatibility for headless browser fetching (cfcea53)
- Use URL constructor instead of string concatenation for API URLs (78dd5aa)
- Remove DATABASE_URL guard that prevented SSM loading (279dbd4)
- Bundle all dependencies into single self-contained file (934efb3)
- Exit 0 for expected errors, reserve exit 1 for unexpected failures (6097b84)
- Exit 0 when invoked with no arguments (61d43d9)

### Refactoring

- Update schema definitions to use zod's url and uuid types (85f8014)
- Rename infra/aws to infra/cloud (83c92b1)
- Replace Lambda aliases with full stack deployments per environment (9cf3ff7)

### Documentation

- Add README and install script for Ubuntu 24 deployment (b7298ef)

### CI/CD

- Load app secrets from SSM instead of GitHub environment secrets (96d7348)
- Move staging deploy and E2E from release to CI pipeline (ced8a48)

### Chores

- Remove Zyte proxy integration (bb3193b)
- Use explicit resource names for all SST resources (e33b35d)
- Remove cef-lambdas package and S3 subscriber Lambda (efbe799)

### Other

- Merge pull request #22 from praser/feat_download_locally (3ca63b2)
- Add stages to build commands in the pipeline (958c226)
- Make AWS credentials available in e2e ci tests (a31ee7d)
- Make AWS credentials available in e2e ci tests (e3758e4)
- Remove unecessary prompts (4ee3768)

## [0.5.0] - 2026-02-17

### Features

- Add browser-based download with screenshot capture (e98bc00)
- Add registrationUrl field to Offer (a48d95b)
- Add useZyte option to download handler payload (8e4efae)
- Replace download cron lambdas with single SQS-triggered handler (298f4ce)

### Bug Fixes

- Add registrationUrl to seedOffers and response shape assertion (5a79312)
- Drop view before removing dependent column in migration (2c59d00)

### Refactoring

- Remove CefFileDescriptor, derive extension/contentType from S3 key (f4f19ab)
- Remove buildCefDownloadUrl in favor of SQS-provided URLs (34f0848)

### Other

- Merge pull request #21 from praser/bugfix-download-from-aws (ddf0b44)
- Merge pull request #19 from praser/bugfix-download-from-aws (9bc0a93)
- Use zyte to download files (53d1fe1)

## [0.4.1] - 2026-02-16

### Bug Fixes

- Disable tsup code splitting to fix Homebrew install (5a6dc5f)

### Other

- Merge pull request #18 from praser/bugfix-v4 (37c905e)

## [0.4.0] - 2026-02-14

### Features

- Add new CEF file downloads with content hash dedup (7abd617)

### Other

- Merge pull request #17 from praser/feat-download-more-files (b8cbd25)

## [0.3.0] - 2026-02-14

### Features

- Split UpdateCefOffers Lambda into download + process with CLI upload (fb19d79)

### Bug Fixes

- Improve CI efficiency and production hardening (4d2caca)
- Show help with available file types when download is run without args (f2a08a4)
- Show help instead of error when running manager without subcommand (973b9b9)

### Refactoring

- Rename management command to manager (259bf25)

### Documentation

- Update CLAUDE.md and skills for management/manager refactoring (a88a43e)

### Tests

- Add 13 new E2E tests for auth, filters, and management (f8f73e7)

### Chores

- Remove Docker image build from release pipeline (b118eeb)

### Other

- Merge pull request #16 from praser/feat-sync-cef-offers (8588e0f)

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
