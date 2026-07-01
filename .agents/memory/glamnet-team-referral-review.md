---
name: GlamNet team/referral/review features
description: Design decisions for team bookings, referrals, and reviews — all additive, no changes to solo booking or brand flows.
---

## Team Bookings
- `booking_team_members` table links a team member (stylistId = stylist_profiles.id) to an appointment
- Lead artist or client can POST `/api/appointments/:id/team-members` to invite others
- Invited artists see pending invitations at GET `/api/team-invitations` and accept/decline via PATCH
- Team payout splits are stored as `payoutPercentage` (integer 0–100) — GlamNet doesn't auto-process splits, purely informational
- `isTeamBooking` flag on `appointments` table marks the booking as a team event
- When the client initiates from the book page with team members selected, member IDs are stored in `sessionStorage("pendingTeamMembers")` — the success page or a future post-payment hook can process them

## Referrals
- `referral_code` (TEXT, UNIQUE) on `users` — 10-char hex uppercase generated at signup
- Shareable link: `/signup?ref=CODE` — the signup page auto-fills the referral code field from the URL
- `referrals` table: referrer_id, referred_id, referred_type (artist|client), status (pending|completed)
- Referral becomes `completed` when the referred user finishes their first booking (appointment status = completed) — triggered inside `reviews.ts` via `maybeCompleteReferral(userId)`
- Bonus amount: controlled by `REFERRAL_BONUS_ZAR` env var (defaults to 0) — no auto-payment, purely tracked; Alwande sets the env var when ready

## Reviews
- Client can only review `completed` appointments
- Client marks an appointment complete via PATCH `/api/appointments/:id/complete` (changes status confirmed → completed)
- Review page: `/reviews/:appointmentId`
- On new review, stylist's `rating` and `reviewCount` on `stylist_profiles` are recomputed from all reviews (not incremental)
- Artist profile shows "New artist" when `reviewCount === 0` instead of "0 rating"
- Reviews tab on artist profile fetches GET `/api/reviews?stylistId=...` (public, no auth needed)

## User type extension
- `formatUser` in `auth.ts` now includes `referralCode` in the returned object
- Frontend uses `(user as any).referralCode` since the generated API type doesn't yet include it
