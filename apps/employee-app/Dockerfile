# CPN Engage — employee-app (serves both the Profile tab "/" and the Feeds
# tab "/feeds"). Vite bakes VITE_* env vars in at BUILD time, so they must be
# passed as build args pointing at whatever URL the *browser* can reach the
# API/bot on (not the in-network Docker service name). Build context MUST be
# the repo root:
#   docker build -f apps/employee-app/Dockerfile \
#     --build-arg VITE_API_BASE_URL=http://localhost:4175 -t cpn-engage-home .
FROM node:24-alpine AS build
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
COPY apps/employee-app apps/employee-app

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter @cpn-engage/shared build && pnpm --filter @cpn-engage/employee-app build

FROM nginx:alpine
COPY docker/nginx-home.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/employee-app/dist /usr/share/nginx/html
EXPOSE 80
