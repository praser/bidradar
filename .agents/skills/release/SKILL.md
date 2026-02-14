---
name: release
description: Manage bidradar releases including automated version bumping from conventional commits, deploying to dev, E2E testing, and promoting to prod. Use when checking release status, understanding the release flow, or rolling back.
---

# Release

Manage bidradar releases and version promotion.

## Release flow

Releases are **fully automated** on merge to `main` (`.github/workflows/release.yml`):

1. All work merges to `main` via pull requests with conventional commit messages
2. Merging to `main` triggers the Release workflow
3. `scripts/bump-version.mjs --dry` determines the semver bump from conventional commits since the last tag
4. Static checks + unit tests run
5. SST deploys to AWS (`dev` alias updated to `$LATEST`)
6. E2E tests run against the deployed `dev` Lambda
7. Version is bumped across all 7 `package.json` files, `CHANGELOG.md` is generated, commit + tag are pushed
8. Lambda version is published and `prod` alias is promoted
9. CLI is built with prod URL baked in, GitHub Release is created with tarball, Homebrew tap is updated

Release commits (`chore(release): v*`) are detected and skipped to prevent infinite loops.

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

### Rollback Lambda (prod)

```bash
# List recent versions
aws lambda list-versions-by-function --function-name <function-name> --max-items 10

# Roll back prod alias to a previous version
aws lambda update-alias --function-name <function-name> --name prod --function-version <previous-version>
```

### Rollback a GitHub Release

```bash
# Delete the release (keeps the tag)
gh release delete v<version> --yes

# Delete the tag too if needed
git tag -d v<version>
git push origin :refs/tags/v<version>
```
