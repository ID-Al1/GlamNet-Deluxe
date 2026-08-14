---
name: Bonisa escrow & payout model
description: How the 82/18 escrow split, dual confirmation, disputes, and audit trail work
---

- App is rebranded **Bonisa** (was GlamNet) in all UI text; variable/file/package names intentionally stay `glamnet`. Canonical logo SVG + French time-of-day greeting live in `artifacts/glamnet/src/components/bonisa-logo.tsx`.
- Escrow model: 82% artist / 18% platform, computed and stored on the appointment at payment fulfillment (`holdEscrow` in api-server `lib/escrow.ts`), released only when both client AND artist confirm via `POST /appointments/:id/confirm-work`.
- **Why conditional updates, not read-modify-write:** an architect review found double-release and post-release-dispute races. All state transitions (confirm, dispute, release) use `UPDATE ... WHERE payout_status='held' AND flag=false` guards so exactly one caller wins. Release is retried on every confirm call whenever both flags are set and status is still held — this recovers stuck records.
- Disputes can only freeze funds still in escrow; a released payout cannot be flipped back to disputed.
- `payout_events` table is an append-only audit trail (never update/delete rows).
- One-sided confirmations escalate to disputed after `CONFIRMATION_TIMEOUT_HOURS` (default 48) via an hourly job started in api-server `index.ts`.
- Artist earnings are always shown NET of the 18% fee (pending/available/lifetime fields on the stylist dashboard API).
- Payment provider must never be named in UI copy — say "Payment processed securely".

**Gotcha:** `lib/db` ships types from `dist/` for tsc even though exports point to `src/` — after schema changes, run `npx tsc -b --force` in `lib/db` or api-server tsc reports missing columns while esbuild builds fine.
