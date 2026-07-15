# CPN Engage — Admin Console (browser destination, not a Teams tab per the
# PRD). Vite bakes VITE_* env vars in at BUILD time — pass the browser-facing
# URLs, not the in-network Docker service names. Build context MUST be the
# repo root:
#   docker build -f apps/admin-console/Dockerfile \
#     --build-arg VITE_API_BASE_URL=http://localhost:4175 \
#     --build-arg VITE_BOT_BASE_URL=http://localhost:4177 -t cpn-engage-admin .
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
COPY services/notification-bot/package.json services/notification-bot/package.json
COPY apps/employee-app/package.json apps/employee-app/package.json
COPY apps/admin-console/package.json apps/admin-console/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/admin-console apps/admin-console

ARG VITE_API_BASE_URL=http://localhost:4175
ARG VITE_BOT_BASE_URL=http://localhost:4177
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BOT_BASE_URL=$VITE_BOT_BASE_URL
RUN pnpm --filter @cpn-engage/shared build && pnpm --filter @cpn-engage/admin-console build

FROM nginx:alpine
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin-console/dist /usr/share/nginx/html
EXPOSE 80
