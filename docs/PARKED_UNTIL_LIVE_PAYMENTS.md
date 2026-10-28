# Parked until live payments are running

Decision (Alwande, 28 October 2026): anything to do with outside payments waits until live payment has gone through, so we can see what we are really dealing with. Nothing below is being built or promised now.

## Referral cash
- Idea: R50 for each artist you refer, and it accumulates.
- Worry: artists referring each other back to back to farm the money, which would hurt honest artists and cost Bonisa.
- Decision: pause all referral cash until live payments work. Referral codes can still exist as a way to see who brought whom, but nothing is paid.
- Remember to promise nothing about referral money to artists yet.

When we come back to this, the protections to consider (not decided):
- Pay only after the referred artist is verified and has completed a few real bookings (we used 3 for reputation credit).
- Block two artists referring each other (circular referrals), and block self-referral and duplicate identities.
- Cap what one artist can earn in a month.
- Pay after the referred artist's first payout has cleared, and take it back if the bookings are cancelled or disputed.
- Pay it from Bonisa's own fee, never from an artist's rate or a client's money.
- Decide whether R50 is fixed or a percentage, and how long it lasts.

## Other payment-related items that wait
- Deposits kept on late client cancellations.
- Any change to how artists are paid, or fees.
- Refund automation (refunds are manual for now).

## Verification exception: ID
- Merveille is verified without her ID for now, by agreement with Alwande, because he has spoken to her. She will be asked to add it closer to the time.
- For the spec: the owner can verify an artist without an ID only with a written reason and a date the ID is due, recorded in the audit log, and the profile shows as "ID pending" to the owner only (never to the public).
