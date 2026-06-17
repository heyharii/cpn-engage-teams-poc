# Test Readiness

## Status As Of June 17, 2026

### Ready To Test Today

- local employee app
- local community feed
- local admin console
- local API state changes
- local bot card preview payloads
- local end-to-end demo scenarios
- Teams manifest rendering
- Teams app zip packaging for sideload preparation

### Not Fully Testable Without Microsoft Tenant Setup

- true Teams personal app sideload
- Teams SSO sign-in
- proactive bot delivery inside Teams chat
- native Teams Communities publishing through Viva Engage

## What “Done Enough To Test” Means Right Now

If the goal is a product and technical POC review, this is testable now on localhost.

If the goal is a true in-Teams demo inside a tenant, we need these four external inputs:

1. Entra app registration client ID
2. Bot registration ID
3. Teams app ID
4. Public HTTPS domain for all web surfaces and callbacks

## Estimated Completion Windows

### Local POC

Ready now.

Suggested smoke test time:

- 30 to 45 minutes for a full walkthrough

### Tenant-Ready Teams Sideload Package

Once IDs and a public domain are available:

- 2 to 4 hours to wire env values, render the manifest, validate URLs, and sideload the app

### First Real Teams Tenant Test

Once the tenant package is sideloaded:

- same day for tab testing
- same day or next day for bot and proactive message validation, depending on tenant policy and bot registration readiness

### Native Communities Posting Test

Only after delegated Viva Engage credentials and a target community are provided:

- 0.5 to 1 day for the spike test

## Recommended Test Order

1. local browser walkthrough
2. admin console scenario triggers
3. bot preview payload checks
4. manifest render and zip packaging
5. Teams sideload in tenant
6. bot delivery in tenant
7. native Communities publishing spike
