# CPN Engage POC Workspace

This folder is the working area for the `CPN Engage` proof of concept.

## Objective

Build a full working proof of concept for the employee engagement ecosystem promised to Central Pattana:

- `CPN Engage Teams App` for private employee journeys
- `Community Feed` for public recognition, leaderboard, and announcements
- `Admin Console` for orchestration, moderation, scheduling, and analytics
- `Native Teams Communities` integration spike through Viva Engage / legacy Yammer APIs

## Structure

- `docs/` - high-level plan and decision documents
- `specs/` - product, feature, and technical specs
- `workstreams/` - execution checklists by stream
- `spikes/` - risky technical validation notes and experiments

## Run Locally

Install dependencies:

`pnpm install`

Start the employee app:

`pnpm --filter @cpn-engage/employee-app dev`

Start the admin console:

`pnpm --filter @cpn-engage/admin-console dev`

Start the community feed:

`pnpm --filter @cpn-engage/community-feed dev`

Start the API:

`pnpm --filter @cpn-engage/api dev`

Start the notification bot scaffold:

`pnpm --filter @cpn-engage/notification-bot dev`

Default URLs:

- `http://localhost:4173` - employee app
- `http://localhost:4174` - admin console
- `http://localhost:4176` - community feed
- `http://localhost:4175/health` - API health
- `http://localhost:4177/health` - notification bot health

Useful bot preview routes:

- `http://localhost:4177/api/cards`
- `http://localhost:4177/api/cards/daily-drop`
- `http://localhost:4177/api/cards/passport-summary`
- `POST http://localhost:4177/api/messages/demo/capstone-unlocked`

Useful end-to-end demo routes:

- `GET http://localhost:4175/api/admin/demo/scenarios`
- `POST http://localhost:4175/api/admin/demo/scenarios/morning-activation`
- `POST http://localhost:4175/api/admin/demo/scenarios/recognition-to-feed`

Teams manifest helpers:

- `pnpm teams:manifest:example`
- `pnpm teams:manifest`
- `pnpm teams:package:example`
- `pnpm teams:package`
- `pnpm poc:smoke`

Readiness and tenant setup:

- [Demo Runbook](/Users/hari/Documents/poc/cpn-engage/docs/demo-runbook.md)
- [Test Readiness](/Users/hari/Documents/poc/cpn-engage/specs/test-readiness.md)
- [Tenant Setup Checklist](/Users/hari/Documents/poc/cpn-engage/specs/tenant-setup-checklist.md)

## POC Principles

- The POC must show the full product story end to end.
- The custom feed is the reliable source of truth for product behavior.
- Native Communities publishing is validated as an integration path, not the only foundation.
- Every major promised feature should be either proven live or clearly marked as a dependency.

## Feed Paths

The POC explicitly covers three feed or distribution paths:

- `Teams private notifications or chat`
- `Custom community feed tab`
- `Native Teams Communities via Viva Engage`
