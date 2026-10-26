# Bonisa payments, cancellation and no-show policy (v2)

Decided with Haiden on 2026-10-26. Alwande makes the final call on money and rules, so this is a draft until he confirms. The numbers live in one file,
`artifacts/api-server/src/lib/bookingPolicy.ts`, and are tested. Not legal advice:
have it read before it is shown to customers.

Items marked **ASSUMPTION** were not stated and need a yes or a change.

## Timeline for an artist

1. Client books and pays a **50% deposit** into escrow.
2. After the service, the artist taps "Request code". The client gives her the code. She types it in. The service is complete. (Not built yet.)
3. The **24 hour complaint window** opens. Money stays held.
4. No complaint: the money is **ready**.
5. Ready money is paid within **24 hours** after that (existing rule: `PAYOUT_WINDOW_HOURS`).

So an artist is normally paid **within about 48 hours** of the service, on business days.

## Cancellation, lateness and no-shows
Example: a R1,000 service. Deposit is R500.

| What happens | Client gets back | Artist keeps (before Bonisa's 18%) |
|---|---|---|
| Client cancels **48 hours or more** before | R500 (all of it) | R0 |
| Client cancels **24 to 48 hours** before (**ASSUMPTION**) | R250 | R250 |
| Client cancels **less than 24 hours** before | R0 | R500 (the deposit) |
| Client is up to **15 minutes late** | Nothing returned | Booking goes ahead, no fee |
| Client is **16 to 30 minutes late** | Nothing returned | Booking goes ahead. **Late fee of 20% of the deposit** (R100, **ASSUMPTION** that it is 20% of the deposit) |
| Client is **more than 30 minutes late** | R0 | R500, counts as a no-show |
| Client does **not show up** | R0 | R500 |
| **Artist** does not show up | **Full refund** | R0, no pay |
| **Artist** cancels | **Full refund** | R0 |

If the client has also paid the other half through Bonisa, the artist keeps only the deposit
in the "late more than 30 minutes", "no-show" and "under 24 hours" rows, and the rest goes back to the client.

Real emergencies: the owner can still refund through the complaints centre.

## Payouts
- Everything ready is paid in **one payout per artist**, not one transfer per booking.
- **Normal bookings:** paid on the next payout day after the 24 hour window closes.
- **Large bookings:** a single booking where the artist's share is **R2,000 or more** is paid on **Monday**, in one batch. (Recommended by me. It is one setting, easy to change.)
- **DECIDE:** payout days for normal bookings. I recommend every weekday.

## The other 50% (the balance): please decide
The deposit is paid at booking. There are two ways to collect the other half:

| | A. Through Bonisa (recommended) | B. Directly to the artist at the appointment |
|---|---|---|
| Bonisa earns on a R1,000 booking | R180 | R90 (18% of the R500 deposit only) |
| Artist is protected if the client does not pay | Yes | No |
| Risk of clients and artists moving off Bonisa | Lower | Higher |

Recommended: **A.** The client pays the balance through Bonisa before the appointment, for example
by 24 hours before. Your current booking screen already has a "pay at appointment" option, which is
the B way. That option would need to change or be limited.

## What is built and what is not
- Built: the rules in `bookingPolicy.ts` with tests, the payout tracker for artists, escrow, the 82/18 split, owner payout batches.
- Not built: the completion code, applying these rules when a client cancels, late fees, the 24 hour complaint window, the Monday rule in payouts, collecting the balance.
- Today when a client cancels, the status changes and nothing else happens: no refund, no fee. The client's money stays held. This is wired up after Peach is set up, because refunds are done through the payment provider.
- Payments are moving to Peach Payments. These rules do not depend on how Peach works.
