---
name: deploy
description: Deploy the bidradar API to AWS using SST with separate staging and prod stages, manage secrets, and run database migrations. Use when deploying, releasing, or managing infrastructure.
---

# Deploy

Deploy the bidradar API to AWS using SST with separate stages per environment.

## Local development

```bash
pnpm db:up              # Start local PostgreSQL
pnpm db:migrate         # Apply migrations
pnpm dev:api            # Start API on localhost:3000
```

## SST deployment

Each environment is a fully independent SST stage with its own Lambda function, function URL, SQS queues, and SSM parameters.

```bash
npx sst deploy --stage staging   # Deploy to staging
npx sst deploy --stage prod      # Deploy to prod
npx sst dev                      # SST live development mode
npx sst remove --stage <stage>   # Tear down a stage
```

### Setting secrets

Secrets are scoped per stage. Set them for each stage you deploy:

```bash
npx sst secret set DatabaseUrl "postgresql://..." --stage staging
npx sst secret set JwtSecret "your-secret-at-least-32-chars" --stage staging
npx sst secret set GoogleClientId "xxx.apps.googleusercontent.com" --stage staging
npx sst secret set GoogleClientSecret "xxx" --stage staging
npx sst secret set AdminEmails "user@gmail.com" --stage staging
```

## Environments

| Environment | SST stage | Updated by |
|---|---|---|
| `staging` | `--stage staging` | Automatic on merge to `main` |
| `prod` | `--stage prod` | Automatic after staging E2E tests pass |
| Personal | `--stage <name>` | Manual deploy |

- **staging**: deployed on every merge to `main`. Used for E2E testing before promoting to prod.
- **prod**: deployed automatically after E2E tests pass against staging. Each stage has its own database.

### Rollback

Rollback by redeploying a previous commit:

```bash
git checkout <previous-tag>
npx sst deploy --stage prod
```

Or revert the commit on main and let the pipeline redeploy.

## Release process

Releases are fully automated on merge to `main`. The release workflow (`release.yml`):

1. Determines semver bump from conventional commits
2. Runs static checks + unit tests
3. Deploys to staging via `npx sst deploy --stage staging` + runs migrations
4. Runs E2E tests against staging
5. Deploys to prod via `npx sst deploy --stage prod` + runs migrations
6. Bumps versions, generates changelog, commits + tags
7. Builds CLI with prod URL, creates GitHub Release with tarball, updates Homebrew tap

See the `release` skill for more details.

## Docker (local development only)

```bash
docker compose up -d                    # Start PostgreSQL + API + Drizzle Studio
docker compose up -d --build api        # Rebuild API image
```

## Database migrations

Each environment has its own database. Migrations are run as part of the release pipeline. To run manually:

```bash
pnpm db:migrate                    # Local (uses BIDRADAR_ENV or defaults to 'local')
pnpm db:migrate --stage staging # Against a remote stage
pnpm db:migrate --stage prod    # Against prod
```

## Important

- The `aws.lambda.Permission("ApiPublicInvoke")` in `infra/cloud/api.ts` is **required** for the Lambda function URL to accept requests. Never remove it.
- SST config uses `removal: "retain"` for `staging` and `prod` stages to prevent accidental resource deletion.
- Each stage creates its own SSM parameter at `/bidradar/{stage}/api-url` and `/bidradar/{stage}/sqs-queue-url`.
