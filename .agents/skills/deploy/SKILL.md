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

## Release process (CLI + API image)

1. Tag the commit: `git tag v<version>`
2. Push the tag: `git push origin v<version>`
3. GitHub Actions will:
   - Build CLI and create tarball
   - Create GitHub Release with the tarball
   - Update Homebrew tap formula
   - Build and push API Docker image to GHCR

## Docker deployment (alternative)

```bash
docker compose up -d                    # Start all services
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
