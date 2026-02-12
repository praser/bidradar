FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/api-contract/package.json packages/api-contract/
COPY packages/db/package.json packages/db/
COPY packages/cef/package.json packages/cef/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --filter @bidradar/api...

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

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
