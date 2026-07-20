# CPN Engage — Teams bot (chat SDK + pg-boss scheduler). Build context MUST be
# the repo root.
#
# Source-hiding build: our TypeScript (services/notification-bot/src +
# packages/shared/src) is bundled by esbuild into a single dist/server.cjs and
# then DELETED, so the shipped image contains no readable source of ours. npm
# dependencies stay in node_modules (third-party, not our code).
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
COPY services/notification-bot/package.json services/notification-bot/package.json
COPY apps/employee-app/package.json apps/employee-app/package.json
COPY apps/admin-console/package.json apps/admin-console/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY services/notification-bot services/notification-bot
RUN pnpm --filter @cpn-engage/notification-bot bundle

RUN rm -rf services/notification-bot/src packages/shared/src

ENV NODE_ENV=production
EXPOSE 4177
CMD ["node", "services/notification-bot/dist/server.cjs"]
