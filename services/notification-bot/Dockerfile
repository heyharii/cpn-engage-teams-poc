# CPN Engage — Teams bot (chat SDK + pg-boss scheduler). Runs via tsx (the
# bot's own "build" script is type-check only, no emit — this matches how it
# already runs on Render). Build context MUST be the repo root:
#   docker build -f services/notification-bot/Dockerfile -t cpn-engage-bot .
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
RUN pnpm --filter @cpn-engage/shared build && pnpm --filter @cpn-engage/notification-bot typecheck

ENV NODE_ENV=production
EXPOSE 4177
CMD ["pnpm", "--filter", "@cpn-engage/notification-bot", "start"]
