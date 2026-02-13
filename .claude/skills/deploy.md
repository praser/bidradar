# Deploy

Deploy the bidradar API to AWS using SST.

## Local development

```bash
pnpm db:up              # Start local PostgreSQL
pnpm db:migrate         # Apply migrations
pnpm dev:api            # Start API on localhost:3000
```

## SST deployment

```bash
npx sst deploy --stage <stage>     # Deploy to AWS
npx sst dev                        # SST live development mode
npx sst remove --stage <stage>     # Tear down
```

### Setting secrets

```bash
npx sst secret set DatabaseUrl "postgresql://..."
npx sst secret set JwtSecret "your-secret-at-least-32-chars"
npx sst secret set GoogleClientId "xxx.apps.googleusercontent.com"
npx sst secret set GoogleClientSecret "xxx"
npx sst secret set AdminEmails "user@gmail.com"
```

## Release process

1. Tag the commit: `git tag v0.0.1-alpha`
2. Push the tag: `git push origin v0.0.1-alpha`
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
