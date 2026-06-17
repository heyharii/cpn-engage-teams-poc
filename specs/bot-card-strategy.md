# Bot Card Strategy

## Goal

Make the Teams chat or bot experience concrete enough for demo, pitch, and technical validation before tenant wiring is complete.

## Card Set In This POC

### `module-assigned`

- Purpose: push a newly assigned learning module
- CTA: `Start module`
- Mirrors: proposal pages showing Teams-based micro-learning delivery

### `daily-drop`

- Purpose: simulate the short daily challenge inside chat
- CTA: `Submit answer`
- Mirrors: the daily challenge screenshots and proposal challenge concept

### `streak-risk`

- Purpose: urgency nudge before an employee loses momentum
- CTA: `Complete today's challenge`
- Mirrors: the streak protection screenshots

### `passport-summary`

- Purpose: summarize score, completion, and recent entries
- CTA: `View passport`, `Share progress`
- Mirrors: the SIAM passport summary screenshots

### `capstone-unlocked`

- Purpose: create a high-energy unlock moment for the final challenge
- CTA: `Start challenge`
- Mirrors: the final challenge unlock concept

### `recognition-approved`

- Purpose: notify that a peer recognition has moved into the public feed
- CTA: `View public post`
- Mirrors: the public recognition workflow between private submission and community feed

## Why This Matters

- It lets us pitch a true Teams conversation layer, not just a tab UI.
- It keeps the architecture realistic: cards are payloads, not screenshots.
- It gives us a clean seam for later integration with the Microsoft Bot Framework or Teams app messaging flows.

## Current Backend Preview Routes

- `GET /api/cards`
- `GET /api/cards/:template`
- `POST /api/messages`
- `POST /api/messages/demo/:template`

## Recommended Demo Order

1. `module-assigned`
2. `daily-drop`
3. `passport-summary`
4. `streak-risk`
5. `recognition-approved`
6. `capstone-unlocked`
