# Demo Acceptance

## Demo Flow

1. Admin signs in and creates a weekly behavior campaign.
2. Employee receives a notification to complete a module.
3. Employee opens the Teams app and completes learning.
4. Employee answers a challenge and submits a reflection.
5. Employee submits recognition with an image.
6. Admin reviews and approves the recognition.
7. Recognition appears in the public feed.
8. Leaderboard score changes.
9. Admin dashboard reflects the new activity.
10. Native Communities spike is demonstrated or reported with exact result.

## Acceptance Criteria

### Must Work

- employee app loads
- admin console loads
- API persists state
- learning completion is tracked
- challenge completion is tracked
- reflection is saved
- recognition flows into moderation
- approved recognition appears in feed
- leaderboard updates from points
- analytics summary changes

### Can Be Simplified

- comments and reactions can remain visual-only for first demo
- feed can use seeded announcements
- media can be image-only

### Must Be Explicitly Reported

- whether native Communities post succeeded
- which account identity performed the post
- any tenant or permission blockers
