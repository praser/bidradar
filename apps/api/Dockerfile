FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# -- Install dependencies (cached layer) --
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/api-contract/package.json packages/api-contract/
COPY packages/db/package.json packages/db/
COPY packages/cef/package.json packages/cef/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --filter @bidradar/api...

# -- Build all packages --
COPY tsconfig.base.json ./
COPY packages/core/ packages/core/
COPY packages/api-contract/ packages/api-contract/
COPY packages/db/ packages/db/
COPY packages/cef/ packages/cef/
COPY apps/api/ apps/api/

RUN pnpm --filter @bidradar/core build
RUN pnpm --filter @bidradar/api-contract build
RUN pnpm --filter @bidradar/db build
RUN pnpm --filter @bidradar/cef build
RUN pnpm --filter @bidradar/api build

# -- Production stage --
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/api-contract/package.json packages/api-contract/
COPY packages/db/package.json packages/db/
COPY packages/cef/package.json packages/cef/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --filter @bidradar/api... --prod

COPY --from=base /app/packages/core/dist/ packages/core/dist/
COPY --from=base /app/packages/api-contract/dist/ packages/api-contract/dist/
COPY --from=base /app/packages/db/dist/ packages/db/dist/
COPY --from=base /app/packages/cef/dist/ packages/cef/dist/
COPY --from=base /app/apps/api/dist/ apps/api/dist/

# Copy Drizzle migrations so the container can run them at startup if needed
COPY --from=base /app/packages/db/drizzle/ packages/db/drizzle/

RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
