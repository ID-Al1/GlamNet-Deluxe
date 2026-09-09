---
name: Bonisa account suspension
description: Durable enforcement boundaries and state-integrity rules for owner-managed artist suspension.
---

Artist suspension is independent from profile verification and must be enforced across both caller authentication and target availability.

**Why:** Blocking only authenticated artist requests still leaves a suspended artist discoverable, bookable, payable, inviteable, and reachable through existing conversations or live streams.

**How to apply:** Preserve verification state, but hide suspended artists from discovery and recommendations; block new bookings, checkout attempts, team invitations, and messages; revoke active event streams; preserve unrelated inbox access and client refunds.

Owner verification decisions must be atomic state transitions from pending only.

**Why:** Replaying verify or reject against another state can create contradictory combinations such as a live profile marked unsubmitted.

**How to apply:** Guard the database update by the expected pending status, require bounded rejection reasons, and set both public visibility and verification status consistently.