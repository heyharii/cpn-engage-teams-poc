# Native Communities Spike

## Goal

Validate whether selected posts from `CPN Engage` can be published into the real Teams Communities experience through Viva Engage / legacy Yammer APIs.

## Success Criteria

- Sign in through Microsoft delegated auth.
- List accessible Viva Engage groups.
- Publish a plain post to the target group.
- Confirm the post appears in Viva Engage and the Communities surface in Teams.

## API Path

- `GET https://www.yammer.com/api/v1/groups.json`
- `POST https://www.yammer.com/api/v1/messages.json`

## Required Inputs

- Microsoft tenant access
- Entra app registration
- Delegated Viva Engage permission
- Test user or service user
- Target community/group ID

## Risks

- delegated-only auth model
- token management
- tenant policy and Viva Engage enablement
- legacy API limitations
- native UI card formatting constraints

## Output

At the end of the spike we should classify native Communities as one of:

- `Proven`
- `Works with caveats`
- `Blocked by tenant or auth`
