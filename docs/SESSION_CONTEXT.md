# Bonisa: session context (as of 28 October 2026)

Read this first in a new session. It is the short version of everything decided and built so far.

## Who and how to work
- Alwande owns Bonisa (South Africa's verified network for beauty artists). Not a coder. Explain simply, with examples. **Never use em dashes.**
- **Standing rule:** anything he asks for should be made as a **Bonisa-styled PDF he can forward** (message and content together in one file), not text pasted into chat. Style: Playfair Display and Inter, plum #6D1F36, cream #FDF8F0, gold #C1793A, photos from artifacts/glamnet/public (hero-bg.png, for-artists-bg.png), QR code to the sign-up link. Generator scripts were in the session scratchpad (HTML rendered to PDF with Playwright). Recreate from the look of docs/*.pdf.
- Live app is being built by **Hayden** (Vercel, Supabase waitlist) from the specs. This repo (branch claude/artist-waitlist-scattering-w0izhi, Replit stack) is the reference and specs, not what goes live. Do not tell him to pull it into Replit.
- Sign group messages as "Bonisa", not with his name.

## What is built (all in this repo, tested, pushed)
Waitlist queue order fix; Artist Contacts (one list, reminders every 3 days, max 3); Artist Updates; branded emails; brand campaigns (brand pays artist rate plus 18% on top, 50% deposit then balance 3 days before, escrow); seat withdrawals and replacements with strikes; reputation and tiers (docs/REPUTATION_ALGORITHM.md); artist cancellation with notice; safety check-in (photo, safe, code); Keep warm plan and Founding Artist badge; owner pages for all of it. Specs: docs/BONISA_BUILD_SPEC.md. Developer notes: replit.md.
Tests: `pnpm --filter @workspace/api-server run test:unit` (14). End-to-end tests were scratch files (not in repo). One old payment test fails now and then (four simultaneous clicks), unrelated, no double charge.

## Launch status and people
- Goal: first 50 verified artists. Founding 50 WhatsApp group has 19 members.
- Day 0 of the keep-warm plan = 26 October (cards and thank-you sent). Nudge Thursday 29 Oct (docs/Bonisa_Day3_Nudge.pdf). Get Ready checklist Monday 2 Nov (docs/Bonisa_Get_Ready_Founding_50.pdf). Day 10 (5 Nov) honest progress update, needs number of founding members. Day 14 spotlight (needs the artist's written OK to use her name, photo, a line about her work). Day 21 plan and date (ask Hayden for a realistic month). Day 28 Founding Artist badge announcement. Messages are in docs/Bonisa_Keep_Warm_Messages.docx.
- People: Anna (nails, very busy, finalise profile call about 4 pm 28 Oct), Merveille (bridal makeup, ID exception: verified without ID for now, add near launch), Lesedi (makeup), Lebogang M (call at 2 pm 28 Oct to finish adding her services), Hope (hair, warm). Dropped: Kylie, Hope's 5 TikTok referrals, the 13 old waitlist emails. No emails to artists, they want to avoid email and WhatsApp messaging to individuals for now. Personalised PDFs wait until verification is ready. Details: docs/WAITLIST_LEADS.md.
- Questionnaires so far (Lesedi, Anna, Merveille): artists distrust a payment plan, love booking page and safety, want to keep deposits on late client cancellations, want unfair reviews checked. Safety asks not yet built: live location share, client ID check, a person to call.

## Parked until live payments (docs/PARKED_UNTIL_LIVE_PAYMENTS.md)
Referral cash (idea: R50 per referred artist, accumulating; worry: artists referring each other back to back), deposits kept on late cancellations, any payment or fee change, refund automation. Promise artists nothing about referral money yet.

## Decisions still open
Day 21 opening date; referral rule when revisited; deposit and late-cancellation rule; whether safety features come before launch; legal review (POPIA, terms for strikes and reputation); invite link is http not https; Founding Artist badge perks (recognition only for now).

## Instagram
They have one, parked for now. When ready: ask for the handle and what it should do (spotlights, invites).
