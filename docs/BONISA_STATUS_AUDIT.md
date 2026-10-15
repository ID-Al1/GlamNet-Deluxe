# Bonisa status audit

Audit date: 15 October 2026. Scope: this repository (`ID-Al1/GlamNet-Deluxe`, branch `claude/bodnisa-roadmap-masterclass-lczsl6`). Code was read and the typecheck was run. The app was **not** run against a live database, and the deployed site was **not** reachable from this workspace, so nothing below proves live behaviour. No secrets or private data are printed here. No code was changed.

Status key: **Done** (confirmed in code), **Partial**, **Not started**, **Blocked**, **Unable to verify**.

## 1. Current state in plain words

- The repo is a working client, artist and brand app with an owner area. It is built on Express, Postgres and React.
- `pnpm run typecheck` passes with **zero errors** across all packages (run today, after `pnpm install`).
- There are **no automated tests** anywhere in the repo.
- The brief says routes `/client`, `/artist` and `/brand` exist. They do **not** exist in this repo. Roles are served from `/dashboard` and `/dashboard/artist` using the user's role. The newer version Haiden built (`bonisa.opusintelligence.co.za/get`) may differ, and I could not open it.
- Payments are wired to **Stripe only**. There is no Peach code yet.
- The model portal does not exist in this repo.

## 2. Checklist with evidence

| Area | Status | Evidence | Gap | Next action |
|---|---|---|---|---|
| A. Repo, build, typecheck | Done | Typecheck passes, 0 errors | No tests; deployed build not compared | Add a smoke test for money and verification (P1) |
| A. Deployment matches repo | Unable to verify | Site not reachable from here | Need Haiden's link and branch | Haiden confirms what is live (P1) |
| B. Client / artist signup, login | Partial | `routes/auth.ts`, pages `auth/login.tsx`, `auth/signup.tsx` | Not tested against a live database | Run one real signup per role (P1) |
| B. Brand portal | Partial | `dashboards/brand-dashboard.tsx`, `casting` routes | What brands can really do is unclear | List brand actions that work (P2) |
| B. Owner area server checks | Done | `requireOwner` in `lib/auth.ts` checks token and `OWNER_EMAIL`; 17 owner routes, all guarded | Owner is one email only; no recovery plan | Document owner access recovery (P2) |
| C. Verification gate | Done | `verified` checked in `stylists.ts:182,559`, `appointments.ts:95`, `casting.ts:105`, `team-members.ts:108` | None found | Keep a test for it (P1) |
| C. Categories | Partial | Hair, Makeup, Nails, Barber, Skincare, Lashes, Brows hardcoded in `lib/categories.tsx`; `specialty` is a free text column | No salons, somatologists or wig categories; salons conflict with rule 7 (individuals only) | Decide categories and the salon question (P2) |
| D. Reputation | Partial | `computeReputationScore` called in `stylists.ts:157`; tier labels Rising, Established, Trusted, Elite and cutoffs in `glamnet/src/lib/reputation.ts` | Computed on the fly from rating and review count; no event log, no stored history, no dispute handling, cutoffs are frontend only | Treat tiers as proposed; move rules to server (P2) |
| E. 18/82 split | Done | `lib/money.ts` with rounding; stored per booking (`appointments.artistPayoutAmount`) | No unit test | Add test with sample amounts (P1) |
| E. Escrow, payout ledger | Partial | `lib/escrow.ts`, `payout-ledger.ts`, owner payouts routes | Manual payouts only; never proven with a live transaction | End to end test with Peach (P1) |
| E. Team bookings | Partial | `team-members.ts` with `payoutPercentage` | Rules for cancellation and partial completion unclear | Document rules (P3) |
| E. Provider | Blocked | Stripe code only (`stripeClient.ts`, `routes/stripe.ts`) | Peach decided, details pending | Wait for Peach, then plan the swap (P1) |
| F. Model portal | Not started | No model schema, routes or pages found | Entire feature | Plan after launch (P3) |
| G. Complaints, disputes | Done | `routes/complaints.ts`, owner complaints pages, adjudication notes in `.agents/memory` | Not live tested | Test one dispute (P2) |
| G. Audit logging | Partial | `payout-events` table; owner actions noted in memory docs | No general audit table for verification and account status | Confirm what is logged (P2) |
| G. Bank details privacy | Done | Masked reads, audited reveals (`owner.ts:372,389`) | None found | None |
| H. Webhook security | Done | Stripe signature checked (`webhookHandlers.ts:30`) | Will change with Peach | Re-do for Peach (P1) |
| H. Secrets in repo | Done | Pattern scan found none | `.gitignore` has no `.env` rule | Add `.env*` to `.gitignore` (P2) |
| H. Uploads | Unable to verify | `routes/storage.ts` issues upload URLs and binds them to the user | File type and size come from the client and I found no server allowlist | Add an allowed type and size check (P1) |
| H. POPIA, privacy policy | Not started | No privacy or consent text in code | Hard gate before first booking | Legal work (P0 for launch) |
| I. Legal documents | Not started | None | See roadmap Part A | Haiden and Alwande (P0 for launch) |
| J. Growth materials | Partial | Intake checklist, game and questionnaire exist outside this repo | Not in the repo | Keep them in one place (P2) |

## 3. Broken, mocked or risky

- **Login passwords** are stored with a single HMAC-SHA256 using one shared secret and **no per-user salt**. If `JWT_SECRET` is unset it falls back to a hardcoded default (`routes/auth.ts:18-23`). This is not a proper password hash.
- **Login tokens never expire.** The token carries an issue time, but `verifyToken` never checks it (`lib/auth.ts:15-29`). A stolen token works forever.
- **Two copies of token code** exist (`lib/auth.ts` and `routes/auth.ts`), which can drift apart.
- **No rate limiting and no login attempt limit.** CORS is fully open (`cors()` in `app.ts:50`). No security headers (no helmet).
- **Token in localStorage** (`glamnet/src/lib/auth.tsx`), readable by any script on the page. The build spec already flags this for the mobile move.
- **Mock image mapping** on the artist profile page (`pages/stylists/[id].tsx:139`): a comment says "Map mock images to services". Check it does not show stock photos in place of missing data (rule 5).
- **No tests** at all.
- **Legacy naming:** about 140 files still say GlamNet, and `stylist*` names remain.

## 4. Prioritised gaps

**P0 (security and launch gates)**
1. Replace password hashing with a salted, slow hash (for example argon2 or scrypt), and remove the hardcoded fallback secret. Existing users will need a safe migration (hash on next login).
2. Add token expiry and check it on every request.
3. Privacy policy, POPIA consent and legal documents live before the first real booking.

**P1 (required for testing and payment)**
4. Add login rate limiting, restrict CORS to the real domains, and add security headers.
5. Validate upload type and size on the server.
6. Tests for the 18/82 split, the verification gate and owner access.
7. Peach integration plan once details arrive. Replace Stripe, re-do webhook verification, and prove one real payment, hold, release and refund.
8. Confirm what is deployed and which version is current.
9. Run one real signup and booking per role.

**P2 (launch readiness)**
10. Decide categories and the salon question. Move tier cutoffs to the server.
11. `.env*` in `.gitignore`. A single audit log for verification and account actions. Owner access recovery plan.
12. Finish the GlamNet to Bonisa rename and the `stylist` to `artist` migration.
13. Release checklist, backups and rollback plan.

**P3 (later)**
14. Model portal, wig ecosystem, AI features, advanced tiers, team booking expansion.

## 5. What works end to end today

Nothing is proven end to end, because the app was not run against a live database here. The code paths exist for signup, verification, gated browse and booking, 18/82 escrow records, manual payouts, complaints and the owner area. Live payments have never been tested.

## 6. Owner answers (15 October 2026)

1. **Which version is live:** both this repo and Haiden's newer version. Consequence: the audit covers only this repo. Haiden's version is unaudited, security fixes must be applied to both, and we still need to know whether the two share a database or user accounts.
2. **Tier names approved:** Rising, Established, Trusted and Elite. Cutoffs (40, 70, 85) are still only in the frontend and should move to the server.

## 7. Open questions

1. Do the two versions share one database, one login system and one set of artists?
2. Are salons and somatologists in scope for launch, given the rule that profiles are individuals?
3. Which version will the 14 November event send people to?
