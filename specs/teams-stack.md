# Teams App Stack

## Recommendation

Yes, we should use `React` for the Teams app surfaces.

For Microsoft Teams, the app is not a special frontend framework of its own. The core experience is usually a web app loaded into Teams as a tab, plus optional bot capability for notifications and chat entry points.

## Recommended Stack

### Employee App And Feed Tab

- `React`
- `TypeScript`
- `Vite`
- `@microsoft/teams-js`

Why:

- Microsoft's tab guidance still uses React as a standard path for tab apps.
- Teams tabs are Teams-aware web pages, so React is a strong fit for a dense product UI.
- `@microsoft/teams-js` is the runtime bridge for context, initialization, dialogs, navigation, and Teams host behavior.

### Authentication

- `Microsoft Entra ID`
- Teams tab SSO through `getAuthToken()`
- Backend token exchange when broader Graph permissions are needed

Why:

- Teams tab SSO is the official pattern for authenticated app experiences in Teams.
- The frontend can obtain the Teams user token, while the backend handles broader Graph access or app-specific authorization.

### Backend

- `Node.js`
- `Fastify`
- `TypeScript`

Why:

- Fastify is fast to scaffold, easy to reason about, and a good fit for POC speed.
- We can keep API, moderation, points, feed, and analytics logic in one backend early on.

### Notifications

- Thin `Teams notification bot`
- Keep it separate from the tab UI conceptually, even if we host it near the API

Why:

- Teams notifications and proactive messages are bot-shaped capabilities, not tab capabilities.
- This keeps our architecture honest: tabs for application UX, bot for notification delivery.

### Native Communities Integration

- `Viva Engage / legacy Yammer APIs`
- Treated as a publishing integration spike

Why:

- This is the only realistic path we have found for posting into Communities that appear in Teams.
- It should not become the source of truth for our product behavior.

## What We Are Not Using As The Core App Stack

### TeamsFx SDK

Not recommended for new core development.

Reason:

- Microsoft states TeamsFx SDK is in deprecation mode.

### Bot-Only Architecture

Not recommended as the main product shell.

Reason:

- Our product is dashboard-heavy and workflow-heavy.
- Tabs are a much better fit for learning, feed, moderation, and analytics surfaces.

## Practical Shape For This POC

1. `Employee Teams app`
   React app hosted as a personal tab.

2. `Community Feed tab`
   React app hosted as another Teams tab or route in the same app shell.

3. `Admin console`
   React web app, optionally later embedded in Teams for admins.

4. `Notification bot`
   Thin service for reminders, nudges, and approval alerts.

5. `Viva Engage integration module`
   Separate backend module for native Communities publishing tests.

## Sources

- Microsoft says Teams SDK is the primary SDK for new Teams development, and TeamsFx SDK is in deprecation mode.
- Microsoft tab guidance still shows the tab portion using JavaScript with React.
- Microsoft tab SSO guidance uses Teams JS plus `getAuthToken()`.
