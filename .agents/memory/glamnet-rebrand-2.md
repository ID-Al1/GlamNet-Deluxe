---
name: Bonisa brand palette
description: Current brand palette (burgundy/cream, Aug 2026) and how to apply palette swaps safely
---
Current palette (from user's mobile mockup, Aug 5 2026): burgundy #6B1F2E = hsl(348 55% 27%) primary/accent; cream bg hsl(39 33% 90%); card cream hsl(42 42% 95%); warm ink text hsl(350 25% 12%). Dark mode: espresso-burgundy base hue 350, primary hsl(349 42% 62%). Supersedes the earlier terracotta (#B8765C) and 4-colour Cream/Plum palettes.

**How to apply palette swaps:** all shadcn tokens live in artifacts/glamnet/src/index.css; named brand vars (--plum, --orange, --baby-blue, --cream) are re-pointed so components using them follow automatically. Hardcoded hexes also exist in bonisa-splash, verified-badge (now tokenized to text-primary/bg-primary/10), stylists index category tiles (cream tiles, burgundy icons), booking/success, client-dashboard hero gradient, artist-initials avatar palettes — grep for old hexes after any swap. Bonisa logo petal colours are canonical, never swap them.

**Why:** review round caught leftover gold rgba borders and a hardcoded dark-burgundy badge colour that failed dark-mode contrast — prefer semantic tokens over fixed hexes in theme-variant UI.
