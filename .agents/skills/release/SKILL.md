---
name: release
description: Manage bidradar releases including automated version bumping from conventional commits, deploying to staging and prod, and E2E testing. Use when checking release status, understanding the release flow, or rolling back.
---

# Release

Manage bidradar releases and version promotion.

## Release flow

Releases are **fully automated** on merge to `main` (`.github/workflows/release.yml`):

1. All work merges to `main` via pull requests with conventional commit messages
2. Merging to `main` triggers the Release workflow
3. `scripts/bump-version.mjs --dry` determines the semver bump from conventional commits since the last tag
4. Static checks + unit tests run
5. SST deploys to staging (`npx sst deploy --stage staging`) + database migrations
6. E2E tests run against the deployed staging Lambda
7. SST deploys to prod (`npx sst deploy --stage prod`) + database migrations
8. Version is bumped across all 7 `package.json` files, `CHANGELOG.md` is generated, commit + tag are pushed
9. CLI is built with prod URL baked in, GitHub Release is created with tarball, Homebrew tap is updated

Release commits (`chore(release): v*`) are detected and skipped to prevent infinite loops.

Secrets are scoped per GitHub environment (`staging` and `prod`), each providing its own `DATABASE_URL`, `JWT_SECRET`, and other credentials.

## Conventional commits

Use conventional commit prefixes -- the release pipeline auto-bumps semver from them:

| Prefix | When to use | Version bump |
|---|---|---|
| `feat:` | New feature | minor |
| `fix:` | Bug fix | patch |
| `chore:`, `docs:`, `refactor:`, `test:`, `ci:` | Non-feature changes | patch |
| `BREAKING CHANGE:` | In commit body, or `feat!:` / `fix!:` | major |

Examples:
```
feat: add neighborhood filter to query command
fix: handle empty CSV rows in CEF parser
refactor: extract filter tokenizer into separate module
ci: add E2E test job to release pipeline
feat!: change offer ID format to UUID
```

## Checking release status

```bash
# List recent releases
gh release list --limit 5

# View a specific release
gh release view v<version>

# Check release workflow runs
gh run list --workflow=release.yml --limit 5

# View workflow run details
gh run view <run-id>
```

## Rolling back

### Rollback prod

Redeploy a previous known-good commit:

```bash
git checkout v<previous-version>
npx sst deploy --stage prod
pnpm db:migrate --stage prod
```

Or revert the problematic commit on `main` and let the pipeline redeploy both stages.

### Rollback a GitHub Release

```bash
# Delete the release (keeps the tag)
gh release delete v<version> --yes

# Delete the tag too if needed
git tag -d v<version>
git push origin :refs/tags/v<version>
```
