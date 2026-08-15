---
name: GlamNet stylistId naming trap
description: stylistId means different things across tables — profile id vs user id — and conversations.stylistId must be renamed on next touch.
---

# stylistId naming trap

## The rule
`stylistId` is **overloaded** — it refers to different things depending on the table:

| Table | stylistId meaning |
|---|---|
| `appointments` | `stylist_profiles.id` (profile id) |
| `services` | `stylist_profiles.id` (profile id) |
| `portfolio_items` | `stylist_profiles.id` (profile id) |
| `casting_applications` | `stylist_profiles.id` (profile id) |
| `conversations` | `users.id` (user id) ← **different** |

## The bug risk
When wiring up "Message this artist", you have the artist's profile object in hand. It is tempting to pass `profile.id` as the `stylistId` for the conversation. **Do not.** The conversation table expects the artist's `users.id`. Pass `profile.userId` (or whatever the user-id field on the profile is) instead, or the conversation will be created and the artist will never see it.

## Pending rename
`conversations.stylistId` should be renamed to `conversations.stylistUserId` the next time messaging is touched, to make the distinction explicit at the schema level.

**Why:** The current name is a silent foot-gun — the column stores a user id but is named the same as profile-id columns everywhere else.

**How to apply:** Any code that reads/writes `conversations.stylistId` must use the artist's `userId`, not her `profileId`. When renaming, update the Drizzle schema, run a direct-SQL migration (TTY bug — see `glamnet-drizzle-push.md`), rebuild `lib/db`, re-run codegen if the field surfaces in the OpenAPI spec, and update all query sites.
