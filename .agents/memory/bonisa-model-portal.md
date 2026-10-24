---
name: Bonisa model portal
description: How the model role, public directory, opportunities and owner review are built and what is deliberately not live.
---

Models are a fourth role beside client, artist and brand. Public visibility needs published AND verified, like artists. Every public DTO is built field by field in `lib/modelDto.ts`; directory filters run on visible fields only.

**Why:** A hidden field must not be discoverable by searching for it, and a new column must never leak by default.

**How to apply:** Add new public fields in `modelDto.ts` only, behind a visibility key. Write an audit row before returning any owner view of private data. Campaign, earnings and contract screens are labelled not live; do not show numbers or statuses there until a real backend exists. Full detail in `docs/BONISA_MODEL_PORTAL.md`.
