---
name: Bonisa product spec and non-negotiables
description: Authoritative product rules, brand rules, and architecture decisions from the Bonisa spec doc (Aug 2026). Check here before any decision that touches identity, payments, verification, copy, or design tokens.
---

## What Bonisa is
Professional identity network for South African beauty artists. Nearest comp: LinkedIn, not Fresha/Booksy. The verified artist profile is the product; the booking calendar is a feature. Single filter for every decision: does this build trust, or erode it?

## Non-negotiables
1. **Verification is a gate.** Unverified artist = not in browse, not bookable, cannot apply to casting calls.
2. **Every booking stores the split.** 18% platform, 82% artist. Stored on the record; never recalculated on the fly.
3. **"artist" not "stylist"** in all user-facing text and new code/DB fields. Legacy `stylist*` identifiers exist; do not create new ones.
4. **Three separate flows.** Client / Artist / Brand — three dashboards, never merged.
5. **Zero fake data.** Empty data = empty state. No placeholders, no stock photos for missing images.
6. **Payments = Stripe only.** Keep payment logic in `stripeClient.ts` / `routes/stripe.ts`.
7. **Artists are individuals.** One profile per person; no salon/venue as primary entity.
8. **POPIA compliance is a hard gate** before the first real booking.

**Why:** These are product moat decisions confirmed by Alwande. Violating them erodes trust, which is the entire value proposition.

**How to apply:** If a request seems to conflict with any of the above, stop and ask Alwande rather than quietly picking one side.

## Brand rules
- Colours from tokens in `index.css` only. Never hardcode hex/rgb in components.
- Token values: plum `#6D1F36` primary, cream `#FDF8F0` bg, ink `#231519` text, gold `#C1793A` highlights, line `#EFE3D3` borders, white `#FFFFFF` cards.
- Playfair Display: logo wordmark, greeting name, hero headlines, large numbers only. Inter: everything else.
- Lucide icons only, strokeWidth 1.9, `currentColor`. Global default set via `.lucide { stroke-width: 1.9; }` in index.css.
- No emoji anywhere in the UI, ever.
- French greeting: Bonjour (before 12), Bon après-midi (12-17:59), Bonsoir (18+). First name in Playfair on next line. Do not translate.
- Logo petals: never recolour, rotate, or redraw.

## Architecture decisions
- `stylistId` = profile ID (`stylist_profiles.id`), NOT user ID. Confusing them is the most common bug.
- `verified` (boolean gate) and `verificationStatus` (`none`/`pending`/`verified`) must always agree.
- OpenAPI spec is the contract. Change spec → run codegen → use generated types. Never hand-write API types.

## User preferences (Alwande)
- Explain in plain language: what changed and what it means for a user.
- No em dashes in copy or explanations.
- Never rename and build features in the same pass.
- Small, checkpointed changes.
- Always read the real codebase first; never guess from memory.
