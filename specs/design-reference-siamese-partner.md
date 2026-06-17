# Design Reference: Siamese Partner

Reference project:

- [siamese-partner](/Users/hari/Downloads/Documents/siamese-partner:1)

## Why It Matters

`siamese-partner` is not a React tab app like `CPN Engage`, but it is a strong reference for:

- Teams-first interaction design
- concise command language
- card-based learning and challenge flow structure
- leaderboard and recognition action framing
- Teams manifest packaging patterns

## Useful Patterns To Reuse

### 1. Four Primary Actions

From [WelcomeCard.tsx](/Users/hari/Downloads/Documents/siamese-partner/src/cards/WelcomeCard.tsx:1):

- Start today's module
- Daily challenge
- Recognise a colleague
- View leaderboard

Why useful:

- these are excellent top-level actions for a Teams-first product
- they are short, direct, and feel native inside Teams

### 2. Module Intro Structure

From [ModuleIntroCard.tsx](/Users/hari/Downloads/Documents/siamese-partner/src/cards/ModuleIntroCard.tsx:1):

- what the module is
- time estimate
- what is inside
- start now or remind later

Why useful:

- it frames learning as a compact operational decision, not a heavy LMS screen

### 3. Quiz Interaction Pattern

From [QuizQuestionCard.tsx](/Users/hari/Downloads/Documents/siamese-partner/src/cards/QuizQuestionCard.tsx:1):

- show full option text in body
- keep answer actions short and clear

Why useful:

- it reduces UI crowding inside Teams surfaces
- it preserves readability when prompts are long

### 4. Leaderboard Framing

From [LeaderboardCard.tsx](/Users/hari/Downloads/Documents/siamese-partner/src/cards/LeaderboardCard.tsx:1):

- top performers first
- keep "you" visible even if outside top positions
- always pair leaderboard with a next action

Why useful:

- leaderboard becomes motivational, not just decorative

### 5. Teams Packaging Direction

From [manifest.json](/Users/hari/Downloads/Documents/siamese-partner/teams-package/manifest.json:1):

- clear command list
- bot scopes defined early
- Teams packaging treated as a first-class project artifact

Why useful:

- reinforces that our Teams manifest and command model should be designed early, not bolted on later

## What We Should Reuse In CPN Engage

- short Teams-native action labels
- quick action menu centered on module, challenge, recognition, leaderboard
- compact module framing with explicit duration
- leaderboard with visible user position
- Teams manifest command lists aligned to real product actions

## What We Should Not Copy Directly

- pure bot-only product shape
- Adaptive Card-only product shell
- pink-heavy brand styling

`CPN Engage` still needs:

- richer tab UI
- custom community feed tab
- admin console
- our own API as source of truth
