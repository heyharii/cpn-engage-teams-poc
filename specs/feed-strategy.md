# Feed Strategy

## The Three Feed Paths

For this POC, we should test three distinct feed or distribution surfaces.

### 1. Teams Private Feed

Meaning:

- direct reminders
- private nudges
- approval alerts
- challenge reminders
- personal activity-style delivery through Teams app or bot chat

Current status:

- covered by `notification-bot` scaffold
- API and payload path already exist
- real Teams delivery still needs bot wiring and tenant credentials

### 2. Custom Community Feed Tab

Meaning:

- our own public social feed inside Teams
- recognition posts
- leaderboard posts
- announcements

Current status:

- fully represented in the current POC architecture
- `community-feed` app exists
- API already supports feed state, recognition approval, and reset flow

This is currently the most reliable public feed path.

### 3. Native Teams Communities Feed

Meaning:

- the real Communities experience inside Teams
- backed by Viva Engage / legacy Yammer posting path

Current status:

- covered as a spike and integration path
- manifest and spec groundwork exist
- real end-to-end proof still depends on tenant access, Entra app setup, delegated auth, and target community availability

This path should be tested, but not used as the only foundation for the product until it is proven in the target tenant.

## Recommendation

Yes, we should try all three.

But we should treat them differently:

- `Custom community feed tab` is the main public product surface.
- `Teams private feed` is the main private delivery surface.
- `Native Teams Communities` is the validation path for external/public company community posting.

## POC Status Matrix

| Feed path | Purpose | Current state | What is missing |
| --- | --- | --- | --- |
| Teams private notifications or chat | Private reminders and alerts | Scaffolded | Real Teams bot delivery wiring |
| Custom community feed tab | Public feed we control | Working architecture | More UI actions and richer API mutations |
| Native Teams Communities via Viva Engage | Real Communities publishing | Spike-ready | Tenant credentials and delegated auth test |

## Test Order

1. Prove `custom community feed tab` end to end.
2. Prove `Teams private notifications or chat` end to end.
3. Prove `native Teams Communities via Viva Engage` with tenant credentials.

This order keeps the product moving even if the native Communities path is blocked by tenant setup or legacy API limitations.
