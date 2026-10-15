# Artist reputation and tiers: how it works

Built from the "Artist Reputation and Tier System" brief (15 October 2026). Every number below lives in
`artifacts/api-server/src/lib/reputation-config.ts`. The maths is in `reputation-score.ts` (no database, fully unit
tested). The engine that reads real data is `reputation.ts`. Change a number in the config and bump `version`; every
score is recalculated from the same recorded events.

## The five parts of a score (0 to 100 each)

| Part | Weight | How it is worked out |
|---|---|---|
| Booking reliability | 30% | (completed + 3) / (completed + 3 + weighted failures + 0.75), over the last 12 months. Failures weigh: late cancel 1.5, last-minute cancel 3, no-show 5. The 3 and 0.75 are "credit" every artist starts with, so a brand-new artist starts at 80 and one bad event cannot wreck a good record. |
| Client satisfaction | 30% | A smoothed average: (sum of stars + 4.0 x 5) / (reviews + 5), then 1 star = 0 and 5 stars = 100. One review cannot dominate. Shown publicly only from 3 reviews. |
| Professionalism | 20% | Starts at 85. Only owner-confirmed conduct cases lower it (minor -5, serious -15), and a case stops counting after 180 days. Punctuality and communication are NOT scored because the app does not record them. |
| Consistency | 15% | 70% success rate over the last 6 months (same formula as reliability) plus 30% activity (active months out of 4). Quiet months only stop the activity part growing. Inside her first verified month the activity part is neutral (0.8). |
| Community | 5% | Starts at 60. Each referral credit adds 10, capped at 4 credits per year. A credit needs the referred artist to be verified and to have completed 3 bookings. |

Overall = 0.30 x reliability + 0.30 x satisfaction + 0.20 x professionalism + 0.15 x consistency + 0.05 x community.
Scores keep full precision and are clamped to 0..100. They are rounded only to display. (So 74.99 is Rising, not Signature.)

## Tiers

| Tier | Score | Completed bookings | Months since verified |
|---|---|---|---|
| New Talent | below 60, or not enough evidence | 0 | 0 |
| Rising Artist | 60 | 5 | 0 |
| Signature Artist | 75 | 15 | 3 |
| Elite Artist | 85 | 30 | 6 |
| Bonisa Icon | 93 | 60 | 12 |

- A tier needs the score AND the bookings AND the time. A score alone unlocks nothing.
- "Enough evidence" means at least 5 completed bookings. Until then the artist shows "Building reputation" and no number is public. Privately she sees a provisional score.
- Active time is whole months since the owner verified her (`stylist_profiles.verified_at`). Artists verified before this existed use the day they joined.
- Promotion happens as soon as she qualifies. Demotion happens only at the monthly review, and only after she has qualified for a lower tier two reviews in a row. One bad review or one event never demotes.

## What counts, and what never does

Facts are written once to a ledger (`reputation_events`) with a unique key per fact, so re-running changes nothing.
A wrong fact is reversed (kept, marked reversed), never deleted. The owner's reversals are never undone by a re-sync.

| Counts | Never counts |
|---|---|
| A completed booking (not under payment dispute) | A cancellation by the client |
| A cancellation by the artist with under 48 hours notice (12 to 48 late, under 12 last-minute) | A cancellation by the platform |
| A no-show the owner confirmed, with a written reason | Any cancellation from before who-cancelled was recorded (counted neutral) |
| A review from the client of a completed booking | A pending allegation or an unproven claim |
| A late or last-minute withdrawal from a campaign seat | A booking cancelled with 48 hours or more notice |
| A conduct case the owner reviewed and confirmed | Anything a user types into a screen |
| A referral that verified and completed 3 bookings | Self-referrals; the same referral twice |

Emergencies: an artist can flag a genuine emergency when she cancels late. The record waits as "under review" and does
not count until the owner decides. Any artist can dispute a cancellation, no-show or conduct record: it stops counting
while it is reviewed. If upheld it is reversed; if rejected it counts again and her score returns exactly to where it was.

## Artist cancellation (new)

Before this, an artist could only confirm or decline a request. Now `POST /appointments/:id/artist-cancel`:

- 48 hours or more notice: free, no mark.
- 12 to 48 hours: late cancellation (lightly counted).
- Under 12 hours: last-minute (counted more).
- The client's payment is marked as owed back in full (`refund_due_amount`), shown to the owner in Withdrawals and refunds.
  This does not touch the payment provider, commission or payouts.
- Campaign jobs are handled through the campaign ("I can't make it"), not here.

## Safety check-in (new)

After a booking starts, the artist can check in: a photo, "I am safe" or "I need help", and "this was my last booking
today". She gets a generated code like `BNS-7K3Q9M` as proof. Only the owner sees the photo. "I need help" messages the owner
at once. An artist who has not checked in 3 hours after a job ends gets one reminder. Codes are random and unique.

## Referrals

Each user already has a generated referral code. Credit toward reputation needs the referred artist to be verified and to
complete 3 bookings. The existing cash bonus is untouched.
**Not built:** the cash incentive as a percentage of what a referred artist earns. `referralIncentivePercent` is 0 in the
config and wired to nothing, because it changes what Bonisa pays and needs the owner to approve the percentage, how long
it runs, and that it comes out of Bonisa's own fee (never the artist's or the client's money).

## Permissions

All checks are on the server. Artists see only their own standing. Public profiles show the tier, and a score only once
there is enough evidence. Owner screens and actions need the owner account. Owner actions (reversals, conduct cases,
no-shows, dispute decisions) require a written reason and are kept in `reputation_audit_log`. Nothing sets a score directly.
Reputation data about people should be reviewed against POPIA by someone qualified. This is a product design, not legal advice.

## Known limits (not hidden)

- Punctuality and communication are not scored: the app does not record them.
- Old cancellations have no "who cancelled" record, so they count neutral.
- The tier badge appears on profile pages and the artist list. Client search ranking is not changed.
- Premium recognition badges and benefits-matrix items (enhanced portfolio, priority consideration) are labels only so far.
- Substitution badges are not built.
- Run the unit tests with `pnpm --filter @workspace/api-server run test:unit`.
