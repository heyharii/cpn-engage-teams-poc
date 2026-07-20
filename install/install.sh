#!/usr/bin/env bash
#
# CPN Engage on-prem installer.
#
#   ./install.sh                 first install (generates .env, starts stack)
#   ./install.sh --update vX.Y.Z  pull a new image tag, migrate, restart
#   ./install.sh --print-key      re-print the admin key from .env
#
# Idempotent: re-running keeps your existing .env (and secrets) unless you pass
# --reset. Requires Docker + the compose plugin.
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=".env"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

rand() { openssl rand -hex "${1:-24}"; }

need_docker() {
  command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found. Install Docker first."; exit 1; }
  docker compose version >/dev/null 2>&1 || { echo "ERROR: 'docker compose' plugin not found."; exit 1; }
}

print_key() {
  [ -f "$ENV_FILE" ] || { echo "No .env yet — run ./install.sh first."; exit 1; }
  # shellcheck disable=SC1090
  grep '^ADMIN_KEY=' "$ENV_FILE" | cut -d= -f2-
}

generate_env() {
  echo "Generating $ENV_FILE with fresh secrets…"
  local admin_key push_token db_pw
  admin_key="$(rand 24)"
  push_token="$(rand 24)"
  db_pw="$(rand 16)"
  cat > "$ENV_FILE" <<EOF
# CPN Engage — generated $(date -u +%Y-%m-%dT%H:%M:%SZ). Keep this file secret.

# Image source (set REGISTRY to your GHCR/registry path).
REGISTRY=ghcr.io/heyharii
TAG=latest

# Database
POSTGRES_USER=cpn_engage
POSTGRES_PASSWORD=$db_pw
POSTGRES_DB=cpn_engage

# Secrets (auto-generated — do not share)
ADMIN_KEY=$admin_key
PUSH_TOKEN=$push_token

# Public hostnames for CORS + bot ops origin (edit to your deployed URLs).
ALLOWED_ORIGINS=http://localhost:4173,http://localhost:4174
ADMIN_ORIGIN=http://localhost:4174

# Host port mappings
API_PORT=4175
BOT_PORT=4177
HOME_PORT=4173
ADMIN_PORT=4174

# Teams / Azure (fill from your Azure Bot + Entra app registration)
TEAMS_APP_TYPE=SingleTenant
TEAMS_APP_ID=
TEAMS_APP_PASSWORD=
TEAMS_APP_TENANT_ID=
APPLICATION_ID_URI=
EOF
  chmod 600 "$ENV_FILE"
}

case "${1:-}" in
  --print-key)
    print_key
    exit 0
    ;;
  --update)
    need_docker
    TAG_ARG="${2:-latest}"
    echo "Updating to tag: $TAG_ARG"
    sed -i.bak "s/^TAG=.*/TAG=$TAG_ARG/" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    $COMPOSE pull
    $COMPOSE up -d
    echo "Updated. Migrations run automatically on api boot."
    exit 0
    ;;
  --reset)
    rm -f "$ENV_FILE"
    ;;
esac

need_docker
[ -f "$ENV_FILE" ] || generate_env

echo "Starting CPN Engage…"
$COMPOSE pull || echo "(pull skipped — using local images)"
$COMPOSE up -d

echo
echo "======================================================================"
echo " CPN Engage is starting."
echo
echo "   Admin console : http://localhost:$(grep '^ADMIN_PORT=' "$ENV_FILE" | cut -d= -f2)"
echo "   Employee app  : http://localhost:$(grep '^HOME_PORT=' "$ENV_FILE" | cut -d= -f2)"
echo
echo "   ADMIN KEY (needed to log into the console — save it now):"
echo
echo "       $(print_key)"
echo
echo " Re-print later with:  ./install.sh --print-key"
echo "======================================================================"
