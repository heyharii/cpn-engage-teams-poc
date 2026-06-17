# Tenant Setup Checklist

## Needed From Microsoft Side

- Microsoft 365 tenant access
- permission to sideload custom Teams apps
- Entra app registration
- Azure Bot registration or equivalent Teams bot registration
- public HTTPS domain for hosted tabs and APIs

## IDs And Values We Need

- `TEAMS_APP_ID`
- `TEAMS_ENTRA_CLIENT_ID`
- `TEAMS_BOT_ID`
- `TEAMS_APP_DOMAIN`
- `EMPLOYEE_APP_URL`
- `COMMUNITY_FEED_URL`
- `ADMIN_CONSOLE_URL`
- `API_BASE_URL`
- `APPLICATION_ID_URI`

## Files To Fill

- [teams/.env.local.example](/Users/hari/Documents/poc/cpn-engage/teams/.env.local.example)
- create `teams/.env.local`

## Commands

Render manifest:

`pnpm teams:manifest`

Build sideload zip:

`pnpm teams:package`

Output:

- `teams/appPackage/dist/manifest.json`
- `teams/appPackage/dist/cpn-engage-teams-app.zip`

## Tenant Test Steps

1. Host the three tab apps and API on public HTTPS URLs.
2. Fill `teams/.env.local`.
3. Render and package the Teams app.
4. Upload the zip into Teams custom apps.
5. Open `CPN Engage Home`, `Community Feed`, and `Admin Command Center`.
6. Validate the bot command list.
7. Validate the demo scenario flow from admin to bot queue.

## Extra Inputs Needed For Native Communities Spike

- delegated Viva Engage user account
- target community or group ID
- Entra permissions approved for that account path
