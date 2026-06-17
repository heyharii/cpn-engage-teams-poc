# Architecture

## Core Direction

Use our backend as the source of truth for product behavior, feed state, approvals, points, and analytics.

## Surfaces

### 1. Teams Employee App

Purpose:

- private learning
- challenges
- reflections
- recognition submission
- personal progress

### 2. Custom Community Feed Tab

Purpose:

- public recognition
- leaderboard visibility
- announcements
- community-style browsing inside Teams

### 3. Admin Console

Purpose:

- campaign creation
- moderation
- scheduling
- analytics
- publishing orchestration

### 4. Native Communities Integration Spike

Purpose:

- validate delegated publishing to real Teams Communities via Viva Engage / legacy Yammer APIs

## Suggested Services

- frontend app for employee Teams surface
- frontend app for admin console
- backend API
- database
- media storage
- notification service
- integration module for Viva Engage publishing

## Suggested Domain Entities

- `User`
- `Behavior`
- `LearningModule`
- `Challenge`
- `ReflectionSubmission`
- `Recognition`
- `Approval`
- `FeedPost`
- `Campaign`
- `PointsLedger`
- `LeaderboardSnapshot`
- `NotificationLog`
- `CommunityPublishLog`

## Integration Notes

### Teams

Use Teams for:

- app shell
- tab surface
- notification entry points
- user access layer

### Native Communities

Use Viva Engage / legacy Yammer APIs for the spike:

- `GET /api/v1/groups.json`
- `POST /api/v1/messages.json`

Expected limitation:

- delegated access only
- post identity is a real user or service user, not a native bot identity

## Decision Rule

If native Communities posting is validated, it becomes an optional outward publishing channel.

If native Communities posting is blocked or unstable, the custom feed remains the authoritative public surface.
