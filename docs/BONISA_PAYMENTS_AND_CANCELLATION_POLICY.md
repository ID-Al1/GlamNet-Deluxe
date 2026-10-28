# Bonisa payments, cancellation and no-show policy (v3)

v3 written 2026-10-28 after Alwande asked for a simple rule and delegated the details.
The numbers live in `artifacts/api-server/src/lib/bookingPolicy.ts` and are tested.
Not legal advice: have it read before it is shown to customers.

## The promise
An artist is never at risk of not being paid. A client never loses money for no reason.

Three rules make that true:
1. **Only Peach says whether money arrived.** No screenshots, no "proof of payment", no manual marking as paid. Both sides see the same status.
2. **An artist never works on money that is not secured.** A booking only shows "Deposit secured" after Peach confirms it.
3. **Money moves only by the rules.** Completion code, then a 24 hour complaint window, then payout. Every rand shows its stage and a pay-by date.

## Timeline
| When | What happens |
|---|---|
| Booking | Client pays the 50% deposit through Peach (card or instant EFT). The slot is held 15 minutes while it confirms. The artist is told about the booking only after it is secured. |
| 48 hours before | Last moment to cancel for a full refund. |
| 24 hours before | The balance (other 50%) must be paid through Bonisa. Reminders go out before this. Not paid: the booking cancels and the artist keeps the deposit. |
| Appointment | Artist asks for the completion code. Client gives it. |
| +24 hours | Complaint window closes. No open complaint: the money is ready. |
| +48 hours | Artist is paid. The pay-by date is shown on her tracker. |

## Cancellation, lateness, no-shows (R1,000 service, R500 deposit)
| What happens | Client gets back | Artist keeps (before Bonisa's 18%) |
|---|---|---|
| Client cancels **48 hours or more** before | R500 (all of it) | R0 |
| Client cancels **less than 48 hours** before | R0 | R500 (the deposit) |
| Client is up to **30 minutes late** | Nothing | Booking goes ahead. After 15 minutes of grace, the artist may shorten the service by the time lost. No late fee. |
| Client is **more than 30 minutes late**, or does not show | R0 | R500 |
| **Artist** cancels or does not show | **Full refund** | R0, and Bonisa is told |

If the balance is also paid, the artist keeps only the deposit in the "less than 48 hours", "more than 30 minutes late" and "no-show" rows. The balance goes back to the client.

### Two changes from v2 (decided by Claude on Alwande's instruction, 2026-10-28)
1. **Two cancellation tiers, not three.** The 24 to 48 hour middle tier is gone. Simpler to explain.
2. **No late fee.** Bonisa cannot reliably collect extra money after a service, and an EFT payment cannot be charged again. Lateness is handled by shortening the service, and more than 30 minutes late counts as a no-show.
To bring the fee back, say so. It would only work for clients who pay by card with a saved card.

## The balance (other 50%)
Paid through Bonisa, not to the artist. Bonisa earns its 18% on the full price, the artist is protected, and there is no reason to move off the app. The client can also pay everything at booking. The "pay at appointment" option should be removed.

## When a payment looks late or missing
| Someone says | What happens |
|---|---|
| Client: "I paid but it still says pending" | Status comes only from Peach. Instant EFT confirms in seconds. If Peach confirms later and the slot is gone, the client is refunded in full automatically. Nobody marks it paid by hand. |
| Artist: "The client's payment is not showing" | Her screen shows the same Peach status. She does not start the service until it says "Deposit secured". A "Payment not showing?" button opens a case and the owner checks the Peach reference the same business day. |
| Artist: "My payout has not arrived" | Her tracker shows the pay-by date and, once paid, the payout reference. Past the pay-by date it says so, opens a case, and the owner sees it on an Overdue payouts list. Bank EFTs can take one business day to show. |
| Client: "The artist did not show" | Full refund by the rules above. Bonisa records it against the artist. |
Bonisa does not promise money penalties for a late payout yet. That decision waits until payouts are automatic.

## What is built and what is not
- Built: the rules above as tested code, the payout tracker with pay-by dates, escrow, the 82/18 split, the completion code, the complaint window, the missing-code report, safety tools.
- Not built, and needs Peach: taking payments and webhooks, refunds by these rules, the balance payment with auto-cancel, automatic payouts, overdue payout alerts, the "payment not showing" buttons. These are written in build order in the plan page.
- Not built, does not need Peach: removing "pay at appointment".
