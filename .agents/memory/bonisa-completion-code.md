---
name: Bonisa completion code and release flow
description: How a booking is completed and when the artist's money is released; invariants to keep
type: project
---
Completing a booking: the artist asks for a 6 digit code (after the appointment start time), the client reads it in her app, the artist types it in. That sets completedAt and a 24 hour complaint window. When the window closes with no open complaint, a job (lib/completionRelease.ts, every 15 minutes) releases the money, splits 82/18, and creates payout ledger lines due within 24 hours.

**Invariants:**
- The code is derived from a stored nonce (HMAC with SESSION_SECRET), never stored. A new request makes a new nonce and kills the old code. Max 5 wrong tries per code, 3 requests per booking, code valid 24 hours (constants in lib/bookingPolicy.ts).
- Never put the code in chat; the artist can read the chat.
- POST /appointments/:id/confirm-work no longer releases money. Only dispute=true works. Do not re-add a path that releases money without the code and the window.
- Filing a complaint does not freeze money by itself. The release job skips any booking with an open complaint (new, under_review, waiting_for_client, waiting_for_artist, escalated). Close the case and the next pass releases it.
- The code sets both workConfirmedBy flags so complaint release logic that checks them keeps working.
- Rules numbers (deposit, windows, late fees) live in lib/bookingPolicy.ts and are confirmed by Alwande 2026-10-26.
