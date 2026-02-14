---
name: deploy
description: Deploy the bidradar API to AWS using SST with dual environments (dev/prod via Lambda aliases), manage secrets, run database migrations, and promote releases. Use when deploying, releasing, or managing infrastructure.
---

# Deploy

Deploy the bidradar API to AWS using SST with dual environments.

## Local development

```bash
pnpm db:up              # Start local PostgreSQL
pnpm db:migrate         # Apply migrations
pnpm dev:api            # Start API on localhost:3000
```

## SST deployment

The API runs on a single Lambda function with two aliases (`dev` and `prod`) that point to specific function versions. Each alias has its own function URL.

```bash
npx sst deploy --stage production    # Deploy to AWS (production stage)
npx sst dev                          # SST live development mode
npx sst remove --stage <stage>       # Tear down a stage
```

### Setting secrets

```bash
npx sst secret set DatabaseUrl "postgresql://..."
npx sst secret set JwtSecret "your-secret-at-least-32-chars"
npx sst secret set GoogleClientId "xxx.apps.googleusercontent.com"
npx sst secret set GoogleClientSecret "xxx"
npx sst secret set AdminEmails "user@gmail.com"
```

## Environments

| Environment | Lambda alias | Promoted via |
|---|---|---|
| `dev` | `dev` alias on latest version | Automatic on merge to `main` |
| `prod` | `prod` alias on stable version | Manual promotion after validation |

- **dev**: receives every merge to `main`. Used for integration/E2E testing.
- **prod**: promoted manually from `dev` after E2E tests pass. Points to a known-good Lambda version.

### Promoting dev to prod

Promotion shifts the `prod` alias to point at the same Lambda version currently serving `dev`:

```bash
# Check which version dev is running
aws lambda get-alias --function-name <function-name> --name dev

# Promote dev version to prod
aws lambda update-alias --function-name <function-name> --name prod --function-version <version>
```

### Rollback

Roll `prod` back to a previous version:

```bash
aws lambda update-alias --function-name <function-name> --name prod --function-version <previous-version>
```

## Release process

Releases are fully automated on merge to `main`. The release workflow (`release.yml`):

1. Determines semver bump from conventional commits
2. Runs static checks + unit tests
3. Deploys to dev via SST
4. Runs E2E tests against dev Lambda
5. Bumps versions, generates changelog, commits + tags
6. Publishes Lambda version and promotes prod alias
7. Builds CLI with prod URL, creates GitHub Release with tarball, updates Homebrew tap

See the `release` skill for more details.

## Docker (local development only)

```bash
docker compose up -d                    # Start PostgreSQL + API + Drizzle Studio
docker compose up -d --build api        # Rebuild API image
```

## Database migrations in production

Run migrations against the production database:

```bash
DATABASE_URL="postgresql://..." pnpm db:migrate
```

## Important

- The `aws.lambda.Permission("ApiPublicInvoke")` in `infra/aws/api.ts` is **required** for the Lambda function URL to accept requests. Never remove it.
- SST config uses `removal: "retain"` for production stage to prevent accidental resource deletion.
