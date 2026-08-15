# Bonisa

Screen specs, acceptance criteria and the working agreement live in docs/BONISA_BUILD_SPEC.md. Read it before any product task.

South Africa's verified professional network for beauty artists. Artists build a verified profile, take direct bookings, and apply to brand campaigns. Clients book a verified artist. Brands staff campaigns from a verified pool.

**Bonisa is a professional identity network, not a beauty booking app.** The nearest comparison is LinkedIn, not Fresha or Booksy. The artist's verified identity is the product; the booking calendar is a feature.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages (run before declaring any task done)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (run after any change to openapi.yaml)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only; see gotchas)
- Required env: `DATABASE_URL` (Postgres), Stripe credentials via the Replit connector

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Frontend: React 19 + Vite + Wouter, Tailwind v4
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval, generated from the OpenAPI spec
- Build: esbuild (CJS bundle)
- Auth: custom HMAC-SHA256 JWT stored in localStorage (`glamnet_auth` key — renaming logs everyone out, handle deliberately)

## Where things live

| What | Where |
|---|---|
| DB schema (source of truth) | `lib/db/src/schema/` |
| API contract (source of truth) | `lib/api-spec/openapi.yaml` — regenerate clients after any change |
| Generated Zod types | `lib/api-zod/src/generated/` — never edit by hand |
| Generated React query hooks | `lib/api-client-react/src/generated/` — never edit by hand |
| API server | `artifacts/api-server/src/` — routes in `routes/`, payment in `stripeClient.ts` |
| Web app | `artifacts/glamnet/src/` |
| Pages | `artifacts/glamnet/src/pages/` |
| Design tokens | `artifacts/glamnet/src/index.css` |
| Shared category icons | `artifacts/glamnet/src/lib/categories.tsx` |
| Agent memory | `.agents/memory/` |

## Architecture decisions

- **`stylistId` is the profile ID (`stylist_profiles.id`), not the user ID.** These are different tables. Confusing them is the most common bug.
- **Verification has two fields on purpose:** `verified` (boolean gate) and `verificationStatus` (`none`/`pending`/`verified`). Both must agree.
- **Payment logic is quarantined** in `stripeClient.ts`, `routes/stripe.ts`, and the booking success page so the provider can be swapped without touching booking logic.
- **The OpenAPI spec is the contract.** Change the spec, run codegen, then use generated types. Do not hand-write API types.
- **Team bookings** split a job via `payoutPercentage` on team members — separate from and not to be confused with the platform's 18% commission.

## Non-negotiables (do not change without explicit instruction from Alwande)

1. **Verification is a gate, not a badge.** An unverified artist must not appear in browse, must not be bookable, must not apply to casting calls.
2. **Every booking records the money split.** 18% platform, 82% artist, stored on the appointment record, never recalculated on the fly.
3. **The word is "artist", never "stylist"** in any user-facing text, new code, or new DB fields. Legacy `stylist*` identifiers exist and are being migrated.
4. **Client, Artist, and Brand flows stay completely separate.** Three roles, three dashboards.
5. **Zero fake data. Ever.** No placeholder artists, invented ratings, prices, reviews, or stock photos substituting for missing data. Empty data = empty state.
6. **Payments are Stripe.** Do not add a second payment system.
7. **Artists are individuals, not salons.** One profile per person; the artist is the brand.
8. **POPIA compliance is required before the first real booking** — consent capture, privacy policy, data retention position.

## Brand

- **Name:** Bonisa. Never GlamNet in user-facing text.
- **Logo:** three petals, plum `#6D1F36` / `#8E3C56` / `#591A2C`, cream centre with gold stroke. Never recolour, rotate, or redraw.
- **Colours (from tokens in index.css — never hardcode in components):** plum `#6D1F36` primary, cream `#FDF8F0` background, ink `#231519` text, gold `#C1793A` ratings/highlights, line `#EFE3D3` borders, white `#FFFFFF` cards.
- **Type:** Playfair Display for logo wordmark, greeting name, hero headlines, large numbers only. Inter for everything else. Never Playfair on buttons, labels, form fields, or body copy.
- **Greeting:** French by device time. `Bonjour,` before 12:00, `Bon après-midi,` 12:00–17:59, `Bonsoir,` from 18:00. First name on the next line in Playfair. Do not translate; keep file UTF-8 so `après` renders.
- **Icons:** Lucide line icons only. Stroke width 1.9, round caps and joins, colour always `currentColor`. No emoji anywhere in the interface, ever.
- **Photography:** real beauty work on real people, warm light, skin tones reflecting the South African user base. `object-fit: cover`. Never stock photos for missing data.

## User preferences

- Alwande is a strong product thinker, not a career developer. Explain changes in plain language: what changed and what it means for a user, not which hook was refactored.
- Do not use em dashes in any user-facing copy or in explanations to Alwande.
- **Never rename and build features in the same pass.** Rename first, confirm clean, then build.
- **Small, checkpointed changes.** Save progress after each phase.
- **Always read the real codebase before changing anything.** Never guess from a file name or from memory.
- If a request conflicts with a non-negotiable above, stop and ask rather than quietly picking one.

## Gotchas

- `stylistId` means the PROFILE id (stylist_profiles.id) in appointments, services, portfolio_items and casting_applications, but the USER id (users.id) in conversations. Rename conversations.stylistId to stylistUserId when messaging is next touched.
- `drizzle-kit push` hits an interactive TTY prompt when adding unique constraints to tables with existing rows. Use direct SQL via node + `pg` module instead.
- The Replit Stripe connector returns `secret`, not `secret_key`. Stripe schema tables must be created by running the migrations script before the first server start.
- After editing `openapi.yaml`, run codegen or generated types silently drift from the server.
- The auth token key is `glamnet_auth` in localStorage. Renaming it logs every existing user out — handle deliberately during rename.
- `lib/db` dist types go stale after schema changes; rebuild the package before using new types.

## Known gaps (do not treat as done)

- Commission and payout fields missing from the appointments table
- Verification does not gate browse, booking, or casting applications
- No POPIA consent capture or privacy policy
- `casting_calls.budget` is free text (campaign spend cannot be totalled)
- `appointments.stylistId` has no foreign key constraint
- No minimum service price validation (R600/hr floor for Phase 1)
- No artist subscription tiers (R99 Basic, R199 Pro)
- Rename from GlamNet to Bonisa incomplete: ~80 files still reference glamnet
