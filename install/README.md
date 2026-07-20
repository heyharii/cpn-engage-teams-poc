# CPN Engage — On-prem install & update

You received: `docker-compose.prod.yml`, `install.sh`, this README, and a
**registry access token** (a read-only GHCR token). You never receive source
code — the images contain only compiled output.

## Requirements
- A Linux host (or any machine) with **Docker** + the `docker compose` plugin.
- Outbound access to `ghcr.io` to pull the images.

## First install

```bash
# 1. Log in to the image registry with the token we gave you (read-only).
echo "<TOKEN_WE_GAVE_YOU>" | docker login ghcr.io -u <YOUR_GH_USER> --password-stdin

# 2. Run the installer. It generates .env with strong secrets and starts everything.
./install.sh
```

The installer prints your **ADMIN KEY** once — save it; you need it to log into
the admin console. Re-print it any time with `./install.sh --print-key`.

Then open:
- Admin console: `http://<host>:4174`
- Employee app:  `http://<host>:4173`

## Point it at your URLs (before going live in Teams)
Edit `.env` and set the public hostnames the browser will use, then
`docker compose -f docker-compose.prod.yml --env-file .env up -d`:

```
ALLOWED_ORIGINS=https://engage.yourcompany.com,https://engage-admin.yourcompany.com
ADMIN_ORIGIN=https://engage-admin.yourcompany.com
```

Also fill the Teams/Azure values in `.env` (from your Azure Bot + Entra app
registration) so the bot + SSO work:
`TEAMS_APP_ID`, `TEAMS_APP_PASSWORD`, `TEAMS_APP_TENANT_ID`, `APPLICATION_ID_URI`.

## Getting updates
When we publish a new version (e.g. `v1.3.0`):

```bash
./install.sh --update v1.3.0
```

That pulls the new images from GHCR, runs any database migrations automatically
(on API boot), and restarts — no source, no manual steps. Roll back by running
the same command with an older tag.

## Backups
A `pg-backup` sidecar writes a nightly `pg_dump` to `./backups/` and keeps 7
days. To restore: `gunzip -c backups/cpn-YYYYMMDD-HHMMSS.sql.gz | docker compose
-f docker-compose.prod.yml exec -T postgres psql -U cpn_engage cpn_engage`.

## Support
On the admin console **System** page, click **Download debug bundle** and send
us the file — it has versions, health, recent logs, and config checksums (no
secrets), which is all we need to diagnose an issue.
