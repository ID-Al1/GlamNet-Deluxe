---
name: Bonisa complaint adjudication
description: Durable privacy and financial-integrity rules for complaint and dispute handling.
---

Complaint evidence must be delivered only through authenticated, private, no-store routes. Owner notes and owner activity belong in owner-only response contracts; claimant contracts must be structurally unable to inherit them.

**Why:** Complaint evidence can contain sensitive personal material, and schema inheritance or public storage URLs make accidental disclosure too easy.

**How to apply:** Keep evidence object paths internal, authorize every read against the complaint, and use independent explicit claimant and owner DTOs.

Complaint payment holds and releases must atomically update appointment escrow state, exact remaining collected value after refunds, payout events, complaint activity, and payout-ledger lines where release occurs. Stripe refund retries reconcile against Stripe's authoritative refunded total.

**Why:** Partial refunds, concurrent owner actions, or fail-soft audit writes can otherwise overpay artists or leave financial state without a reliable paper trail.

**How to apply:** Reuse transaction-aware escrow transitions, lock payment rows for refunds, derive retry-stable idempotency from the target refunded total, and block release when no collected balance remains.