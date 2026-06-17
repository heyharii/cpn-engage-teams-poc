# Int Labs Proposal Review

## What the proposal gets right

- Teams-native entry point is the right behavior change surface because employees already live in Teams.
- A chatbot-style experience is strong for daily prompts, micro-learning, quick reflections, and streak-based nudges.
- The four most compelling feature pillars are clear:
  - learning journey
  - daily challenges and leaderboard
  - contextual resources
  - peer recognition or moment capture

## Where our current POC is stronger

- We are not locking the product into a bot-only shape.
- We support three feed surfaces instead of one:
  - private Teams notifications or chat
  - custom public community feed tab
  - optional native Teams Communities publishing via Viva Engage
- We keep the admin and moderation layer first-class, which is important for enterprise rollout.
- We avoid making the whole promise depend on legacy Viva Engage posting.

## Decision

Use the Int Labs proposal as a UX reference, not as the architecture.

That means we should adopt these experience patterns:

- bot-style `daily drop`
- streak nudges
- capstone unlock moment
- personal progress passport
- peer recognition flow

But we should keep this delivery model:

- `Employee App` as the private Teams tab home
- `Notification Bot` for reminders and challenge pushes
- `Community Feed` as the controlled public feed
- `Admin Console` for moderation, publishing, and analytics
- `Native Communities Spike` as an optional publishing extension

## Mapping into this POC

| Proposal idea | POC implementation |
| --- | --- |
| Micro modules in Teams | `apps/employee-app` next module card |
| Daily challenge via bot | `apps/employee-app` daily drop card + `services/notification-bot` |
| Leaderboard and momentum | `apps/community-feed` weekly leaders + spotlight |
| Moment capture recognition | `apps/employee-app` recognition submission + admin approval |
| Public recognition across org | `apps/community-feed` timeline |
| Progress passport | `apps/employee-app` passport panel + recent entries |
| Final challenge / capstone | `apps/employee-app` capstone panel |

## Recommendation

For the pitch, present our approach as:

`A Teams-first employee engagement ecosystem with bot-led daily activation, a personal growth passport, and a public recognition layer that can optionally publish into native Teams Communities.`
