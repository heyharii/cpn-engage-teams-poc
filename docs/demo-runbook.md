# Demo Runbook

## Fast Answer

### When is this “finished enough”?

For local POC review: finished enough now.

For first real Teams tenant test: finished enough as soon as tenant IDs and public HTTPS URLs are provided.

## What Can Be Tested Right Now

### Local Browser Test

Start the stack:

1. `pnpm --filter @cpn-engage/api dev`
2. `pnpm --filter @cpn-engage/notification-bot dev`
3. `pnpm --filter @cpn-engage/employee-app dev` (Profile at `/`, Feeds at `/feeds` — one app)
4. `pnpm --filter @cpn-engage/admin-console dev`

Open:

- `http://localhost:4173` — Profile
- `http://localhost:4173/feeds` — Feeds
- `http://localhost:4174` — Admin

### One-Command Smoke Test

With API and bot running:

`pnpm poc:smoke`

This validates:

- API health
- bot health
- bootstrap state
- daily drop and passport presence
- end-to-end demo scenarios
- relay from API to bot queue
- Adaptive Card preview availability

## Recommended Demo Flow

### Story 1: Morning activation

1. Open `Admin Command Center`
2. Run `Morning activation`
3. Show bot card queue in the admin `Bot card lab`
4. Open employee app and explain the private start-of-day journey

### Story 2: Recognition to public feed

1. Run `Recognition to feed`
2. Show the public post appearing in `Community Feed`
3. Explain moderation control and publish destinations

### Story 3: Streak recovery

1. Run `Streak recovery`
2. Show updated streak and passport entries in employee app
3. Explain the reminder and habit loop

### Story 4: Capstone launch

1. Run `Capstone launch`
2. Show progress moving to `100%`
3. Show capstone unlock card in the bot queue
4. Show capstone panel in employee app

## Teams Tenant Test Flow

1. Fill `teams/.env.local`
2. Run `pnpm teams:package`
3. Upload `teams/appPackage/dist/cpn-engage-teams-app.zip` to Teams
4. Open:
   - `CPN Engage Home`
   - `Community Feed`
   - `Admin Command Center`
5. Validate bot commands:
   - `Start today's module`
   - `Daily challenge`
   - `Recognise a colleague`
   - `View leaderboard`
   - `View passport`
   - `Launch capstone`

## What Is Still External Dependency

- Teams SSO
- real proactive delivery inside Teams chat
- native Communities publishing through Viva Engage

## Practical Timing

- local walkthrough: `30-45 minutes`
- render and package Teams app: `5-10 minutes`
- tenant config once IDs exist: `2-4 hours`
- first in-Teams tab validation: `same day`
