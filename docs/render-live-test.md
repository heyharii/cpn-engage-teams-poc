# Render Live Test

## Live URLs

- Employee app: `https://cpn-engage-home-teams-poc.onrender.com`
- Community feed: `https://cpn-engage-feed-teams-poc.onrender.com`
- Admin console: `https://cpn-engage-admin-teams-poc.onrender.com`
- API: `https://cpn-engage-api-teams-poc.onrender.com`
- Bot preview service: `https://cpn-engage-bot-teams-poc.onrender.com`

## What Is Working Now

- Employee app loads live bootstrap data from the hosted API
- Community feed shows live leaderboard and publishing destinations
- Admin console loads moderation queue, bot card templates, and demo scenarios
- API demo scenarios update bootstrap/feed state
- API relays notifications into the hosted bot preview service
- Bot preview service returns Adaptive Card-ready demo payloads

## Quick Browser Test

1. Open the employee app URL.
2. Confirm:
   - `Signed in as Narin from Retail Operations`
   - daily drop question appears
   - passport score and streak are visible
3. Open the community feed URL.
4. Confirm:
   - weekly leaders are visible
   - `3 feeds we can demo` appears
   - public posts are listed
5. Open the admin console URL.
6. Confirm:
   - moderation queue is visible
   - `6 templates ready`
   - demo scenarios are listed

## End-To-End Demo Test

1. Reset state:
   - `POST /api/admin/demo/reset`
   - `POST /api/messages/reset` on the bot service
2. Run a scenario:
   - `POST /api/admin/demo/scenarios/morning-activation`
   - or `recognition-to-feed`
   - or `streak-recovery`
   - or `capstone-launch`
3. Check:
   - employee app updates
   - community feed updates when relevant
   - bot preview queue receives new messages

## Still Needed For Real Microsoft Teams Test

- `TEAMS_APP_ID`
- `TEAMS_ENTRA_CLIENT_ID`
- `TEAMS_BOT_ID`
- tenant with custom app upload enabled
- Entra app + Bot registration that points to the hosted public URLs

## Important Note

This POC is now browser-testable and hosted publicly.

Real in-Teams tab validation can start as soon as the tenant IDs and bot registration are available.
