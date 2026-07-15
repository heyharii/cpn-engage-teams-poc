# CPN Engage — API service (Fastify). Build context MUST be the repo root
# (pnpm workspace needs every package.json to resolve the lockfile), e.g.:
#   docker build -f services/api/Dockerfile -t cpn-engage-api .
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

# Install deps first (better layer caching): copy only manifests.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
COPY services/notification-bot/package.json services/notification-bot/package.json
COPY apps/employee-app/package.json apps/employee-app/package.json
COPY apps/admin-console/package.json apps/admin-console/package.json
RUN pnpm install --frozen-lockfile

# Now bring in the source and build the API + its workspace dependency.
COPY packages/shared packages/shared
COPY services/api services/api
RUN pnpm --filter @cpn-engage/shared build && pnpm --filter @cpn-engage/api build

ENV NODE_ENV=production
EXPOSE 4175
CMD ["pnpm", "--filter", "@cpn-engage/api", "start"]
