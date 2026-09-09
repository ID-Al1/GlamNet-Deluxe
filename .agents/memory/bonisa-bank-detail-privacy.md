---
name: Bonisa bank-detail privacy
description: Durable privacy, audit, and concurrency rules for artist bank details and manual payouts.
---

Full bank account numbers must never appear in ordinary artist or owner reads. Reveal is an explicit owner-only action for a verified account, and its audit row must commit before the number is returned.

**Why:** Bank details are sensitive payout credentials; cached or stale UI state can disclose a number without a fresh, logged owner action.

**How to apply:** Return server-generated last-four masking by default, use private no-store reveal responses, scope revealed state to the account, invalidate pending responses on every close or navigation path, and retain reveal logs against account deletion.

Owner verification must be tied to the exact revision reviewed, and manual payout recording must recheck verified status transactionally.

**Why:** An artist can update details while the owner is reviewing or paying, which could otherwise verify or pay an unseen account.

**How to apply:** Increment a monotonic revision whenever bank details change, reject stale verification actions, reset changed accounts to pending, and lock/recheck the verified bank row before changing payout records.