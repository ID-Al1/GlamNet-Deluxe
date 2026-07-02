---
name: GlamNet design tokens
description: Settled palette decisions — gold primary, cream base, rose demoted. Token locations and "New artist" zero-state rule.
---

## Palette (settled — do not reopen)
- **Gold accent** `#B8893A` = `hsl(38 52% 47%)` light / `hsl(38 50% 58%)` dark → `--primary`, `--accent`, `--ring`, sidebar variants
- **Cream base** background `hsl(36 30% 97%)` light / charcoal dark (unchanged)
- **Rose `#C4526E`** demoted to secondary highlights only — NOT primary anywhere

## Token location
All in `artifacts/glamnet/src/index.css` — Tailwind v4, `@theme inline` block + `:root` / `.dark` HSL vars.

## Shared components
- `artifacts/glamnet/src/components/ui/verified-badge.tsx` — `<VerifiedBadge size="sm|md" variant="pill|icon" />` — gold colour baked in (not from CSS primary token), use this everywhere.

## "New artist" zero-state rule
When `reviewCount === 0` (or falsy), show a gold sparkle pill "New artist" — never show "0 (0)". Applied in: artist listing cards (`stylists/index.tsx`) and artist profile trust row (`stylists/[id].tsx`).

## Artist image placeholder rule (guardrail)
No fake/stock/AI portrait photos anywhere. Use `ArtistInitials` gradient + initials component (inlined in each page for now). Background: deterministic palette from `name.charCodeAt(0) % palettes.length`.

## Session 1 punch list — done
Tagline, palette tokens, shimmer/texture placeholders, New Artist rule, VerifiedBadge, category image tiles, search placeholder, sticky Book button (mobile), specialty pill, casting empty state.

## LATER (do not start without separate brief)
Activity-based profile tiering, response-time metric, map card (geo + map lib), Trending Looks, bottom nav redesign, AI sparkle search, About/Availability profile tabs, info panel fields (hours/member-since/languages), Team Members stat on web profile.
