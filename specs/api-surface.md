# API Surface

## Bootstrap

- `GET /health`
- `GET /api/bootstrap`
- `GET /api/users/me`

## Employee Journeys

- `GET /api/modules`
- `POST /api/modules/:id/complete`
- `GET /api/challenges`
- `POST /api/challenges/:id/submit`

## Feed And Leaderboard

- `GET /api/feed`
- `GET /api/leaderboard`

## Recognition

- `GET /api/recognitions/pending`
- `POST /api/recognitions`
- `POST /api/admin/recognitions/:id/approve`

## Notifications

- `GET /api/notifications`
- `POST /api/notifications`

## Current Working UI Actions

- employee app can refresh state
- employee app can complete a module
- employee app can submit a challenge
- employee app can submit a recognition
- admin console can approve a recognition
- admin console can reset the demo
- community feed can refresh to reflect the latest public feed state

## Demo Control

- `POST /api/admin/demo/reset`
- `GET /api/admin/demo/scenarios`
- `POST /api/admin/demo/scenarios/:name`

Current scenarios:

- `morning-activation`
- `recognition-to-feed`
- `streak-recovery`
- `capstone-launch`

## Notification Bot Placeholder

- `GET /health`
- `GET /api/messages`
- `GET /api/cards`
- `GET /api/cards/:template`
- `POST /api/messages`
- `POST /api/messages/demo/:template`
- `POST /api/messages/reset`
- `POST /api/notifications/test`

## Adaptive Card Templates

- `module-assigned`
- `daily-drop`
- `streak-risk`
- `passport-summary`
- `capstone-unlocked`
- `recognition-approved`
