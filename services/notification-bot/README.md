# CPN Engage Teams Bot

A real Microsoft Teams conversational bot built on the [`chat`](https://www.npmjs.com/package/chat)
SDK. It replies to messages with Adaptive Cards and shares the **same cross-app
state as the three tabs** by reading from / writing to the CPN Engage API — so a
daily drop completed in chat moves the same passport, streak, and leaderboard
the Employee App shows.

## Conversation surface

| User says / taps | Bot replies with |
| --- | --- |
| `hi`, `help`, menu button | Welcome card (5 quick actions) |
| `start today's module` | Module intro → **Start the drop** |
| `daily drop`, `challenge` | Daily drop question (numbered answer buttons) |
| taps an answer | Coaching result card + writes completion to the API |
| `leaderboard`, `rank` | Live weekly leaderboard (from the shared API) |
| `passport`, `my progress` | Live passport (score / streak / modules) |
| `recognise Somruk T.` | Sends a recognition into the Admin moderation queue |

Every handler is guarded — a thrown error always returns an Error card, never
silence. Unknown text routes to the menu.

## Endpoints

- `GET  /health` — liveness (Render health check)
- `POST /api/messages` — Bot Framework webhook (set as the Azure Bot messaging endpoint)
- `POST /internal/notify` — internal notification relay from the API

## Required environment variables (Render dashboard)

| Var | Value | Notes |
| --- | --- | --- |
| `TEAMS_APP_ID` | `e5f13ff0-66c0-4d5c-9ca0-69e49e7180be` | Azure Bot Microsoft App ID |
| `TEAMS_APP_PASSWORD` | _client secret_ | Entra app registration → Certificates & secrets |
| `TEAMS_APP_TYPE` | `MultiTenant` | so the bot serves Teams in a different tenant than the Azure subscription |
| `TEAMS_APP_TENANT_ID` | _(optional)_ | only used for SingleTenant |
| `API_BASE_URL` | `https://cpn-engage-api-teams-poc.onrender.com` | shared state |

## Cross-tenant note

The Azure Bot was registered in the **engineeringtheravenry** tenant, but Teams
is sideloaded in **Ravenry881**. For the bot to authenticate across tenants, the
Entra app registration must be **Multitenant** (App registrations → Authentication
→ Supported account types → "Accounts in any organizational directory").

## Run locally

```bash
API_BASE_URL=https://cpn-engage-api-teams-poc.onrender.com \
TEAMS_APP_ID=... TEAMS_APP_PASSWORD=... \
pnpm --filter @cpn-engage/notification-bot start
```
