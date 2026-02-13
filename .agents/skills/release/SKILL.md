---
name: release
description: Manage bidradar releases including version bumping, conventional commits, tagging, and promoting dev to prod. Use when creating releases, checking release status, or rolling back.
---

# Release

Manage bidradar releases and version promotion.

## Release flow

1. All work merges to `main` via pull requests
2. Merging to `main` triggers CI (build + typecheck + unit tests)
3. To release, tag a commit and push the tag
4. Tag push triggers the Release workflow (CLI tarball, GitHub Release, Homebrew tap, Docker image)
5. The `dev` Lambda alias is updated on merge to `main`
6. After E2E validation against `dev`, manually promote to `prod`

## Creating a release

### 1. Ensure main is up to date

```bash
git checkout main
git pull origin main
```

### 2. Bump version

Update the version in the root `package.json`:

```bash
# Check current version
grep '"version"' package.json
```

Follow semver: `MAJOR.MINOR.PATCH` (use `-alpha`, `-beta` suffixes for pre-releases).

### 3. Tag and push

```bash
git tag v<version>
git push origin v<version>
```

### 4. Verify release

```bash
gh run list --workflow=release.yml --limit 5
gh release list --limit 5
```

## Conventional commits

Use conventional commit prefixes for clear changelogs:

| Prefix | When to use | Version bump |
|---|---|---|
| `feat:` | New feature | minor |
| `fix:` | Bug fix | patch |
| `docs:` | Documentation only | none |
| `refactor:` | Code restructuring, no behavior change | none |
| `test:` | Adding or updating tests | none |
| `ci:` | CI/CD changes | none |
| `chore:` | Maintenance, dependencies | none |
| `perf:` | Performance improvement | patch |
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

## Promoting dev to prod

After E2E tests pass against the `dev` environment:

```bash
# Get the current dev version
aws lambda get-alias --function-name <function-name> --name dev

# Promote to prod
aws lambda update-alias --function-name <function-name> --name prod --function-version <version>
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

## What the Release workflow does

Triggered by pushing a `v*` tag. Two parallel jobs:

1. **release-cli**: Build CLI, create tarball, create GitHub Release, update Homebrew tap
2. **release-api-image**: Build and push API Docker image to `ghcr.io/praser/bidradar-api`

The image is tagged with both the version and `latest`.
