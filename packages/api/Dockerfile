FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN pnpm install --frozen-lockfile --filter @bidradar/api...

COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

RUN pnpm --filter @bidradar/shared build
RUN pnpm --filter @bidradar/api build

EXPOSE 3000
CMD ["node", "packages/api/dist/index.js"]
