# Teams Packaging

This folder holds Teams-specific packaging and manifest material for the POC.

## What Belongs Here

- `appPackage/manifest.template.json`
- Teams app icons
- environment placeholders for local, dev, or tenant-specific URLs

## Intended Capabilities

The POC app package should eventually include:

- `staticTabs` for the employee app, community feed, and admin console
- `bots` for notifications and reminders
- `webApplicationInfo` for Teams SSO

## Current Tab Shape

- `CPN Engage Home`
- `Community Feed`
- `Admin Command Center`

## Render The Manifest

Use the example values:

`pnpm teams:manifest:example`

Build an example sideload zip:

`pnpm teams:package:example`

Use tenant-specific local values:

`cp teams/.env.local.example teams/.env.local`

Fill the tenant values, then run:

`pnpm teams:manifest`

Build the sideload zip:

`pnpm teams:package`

Output:

- `teams/appPackage/dist/manifest.json`
- `teams/appPackage/dist/cpn-engage-teams-app.zip`
- copied `color.png` and `outline.png` if those assets exist

## Current Status

- manifest template created
- render script created for tenant-specific manifest output
- package script created for Teams sideload zip output
- placeholder `color.png` and `outline.png` created for sideload packaging
- Entra app IDs and bot IDs still to be filled
