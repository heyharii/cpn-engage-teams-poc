# CPN Engage — API service (Fastify). Build context MUST be the repo root.
#
# Source-hiding build: our TypeScript (services/api/src + packages/shared/src)
# is bundled by esbuild into a single dist/server.cjs and then DELETED, so the
# shipped image contains no readable source of ours. npm dependencies stay in
# node_modules (they're third-party, not our code).
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

# Bundle our source (api + inlined shared) into one file; keep npm deps external.
COPY packages/shared packages/shared
COPY services/api services/api
RUN pnpm --filter @cpn-engage/api bundle

# Strip all of our source — only the bundle remains.
RUN rm -rf services/api/src packages/shared/src services/notification-bot/src

ENV NODE_ENV=production
EXPOSE 4175
CMD ["node", "services/api/dist/server.mjs"]
