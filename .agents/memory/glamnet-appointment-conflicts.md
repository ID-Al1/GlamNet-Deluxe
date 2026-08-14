---
name: GlamNet appointment conflict prevention
description: How double-bookings are prevented atomically and how to detect the DB error in Drizzle/pg code.
---

Conflict prevention for appointments relies on a partial unique index (not application-level pre-checks):
`CREATE UNIQUE INDEX appointments_stylist_slot_active_unique ON appointments (stylist_id, date, time) WHERE status IN ('pending','confirmed')`.
Pre-checks (e.g. before starting a Stripe checkout) are a UX nicety only — the index is the actual race-condition-safe guard.

**Why:** app-level "check then insert" has a race window between concurrent requests; only a DB constraint enforced at insert time is atomic.

**How to apply:** when inserting an appointment, wrap the insert in try/catch and detect a unique violation via `err.code === '23505'`. With Drizzle + node-postgres, the pg error code is NOT on the thrown error directly — Drizzle wraps it in `DrizzleQueryError` and puts the real pg error in `err.cause`. Check `err.code ?? err.cause?.code`.

Migration scripts that need the `pg` package must live under `lib/db/scripts/` (or another package that actually depends on `pg`) and be run with `node <path>` from that package's directory — placing/running them elsewhere fails with `MODULE_NOT_FOUND` because pnpm doesn't hoist `pg` to the workspace root or unrelated packages.
