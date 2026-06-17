# CPN Engage POC Plan

## Recommendation

Build one integrated proof of concept with three working surfaces:

1. `CPN Engage Teams App`
2. `Custom Community Feed Tab`
3. `Admin Console`

Run `Native Communities Publishing` as a parallel spike. This gives us a full working product story while keeping the POC resilient if native Communities has tenant, auth, or legacy API constraints.

## What The POC Must Prove

- Employees can complete learning, challenges, and reflections in Teams.
- Employees can submit recognition with media.
- Admins can approve recognition, create campaigns, and publish content.
- Public engagement appears in a community-style feed in Teams.
- Leaderboard and analytics update based on real usage events.
- Notifications and reminders bring users back into the flow.
- Native Communities posting is tested and documented.

## Surfaces

| Surface | Purpose | Status |
| --- | --- | --- |
| Teams App | Private employee flows | Must work |
| Custom Feed Tab | Public social feed | Must work |
| Admin Console | Orchestration and insights | Must work |
| Teams Notifications | Nudges, reminders, approvals | Must work at basic level |
| Native Communities | Real public community publishing | Spike |

## Phases

### Phase 1: Foundation

- Teams app shell
- Admin console shell
- backend schema
- auth flow
- demo roles and seeded users
- native Communities spike setup

### Phase 2: Employee Journeys

- home dashboard
- learning journey
- challenge and quiz
- reflection submission
- points ledger
- leaderboard summary

### Phase 3: Public Feed And Moderation

- recognition submission
- approval queue
- custom feed tab
- leaderboard posts
- campaign composer
- publish destination selector

### Phase 4: Notifications, Analytics, Demo Hardening

- Teams reminders
- approval notifications
- analytics dashboard
- seeded demo content
- native Communities spike result
- end-to-end demo script

## Demo Story

1. Admin creates a behavior campaign.
2. Employee receives a Teams notification.
3. Employee opens the app and completes learning.
4. Employee answers a challenge and submits a reflection.
5. Employee submits recognition with an image.
6. Admin approves the recognition.
7. Recognition appears in the public feed.
8. Leaderboard updates.
9. Analytics reflect the activity.
10. A selected post is tested against native Communities.

## Final Position

The POC should position `CPN Engage` as one Teams-based ecosystem with:

- one private employee app
- one public feed surface
- one admin orchestration console

Native Communities should be presented as a validated integration path where tenant conditions allow it.
