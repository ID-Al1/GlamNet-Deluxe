# Bonisa fixes, version 2

**Checked against your real code**, commit `4bce6fd`, pulled after your push. Version 1 was written against the 7 July repo and is now obsolete. Delete it.

---

## First, a correction. I was wrong about the biggest thing.

I told you: *"Your business model isn't in the software. It's a restaurant with a beautiful dining room and no till."*

**That is no longer true, and I owe you a straight retraction.** Between 7 July and now, someone built a proper escrow system. It is in the code today:

- `lib/escrow.ts` with an 82/18 split and rounding to whole cents
- **Dual work confirmation.** Both the client and the artist have to confirm the job was done before money is released. Neither side can release it alone.
- **Dispute handling.** Either party can raise a dispute, which freezes the funds for manual review.
- **An escrow timeout** that auto-flags stale held payments.
- **A `payout_events` audit table** recording every state change with who did it, when, and the amounts.
- Stripe payment intents, deposits, tips, and balance due.

That is better than what I designed for you. The dual-confirmation model in particular is a real trust mechanism and it is exactly the right instinct for a business whose whole thesis is trust. I designed a simple 24-hour timer. What is actually built is more careful than that.

The dashboard bug I flagged in `dashboard.ts` has also already been fixed, and artist earnings there already use the artist's share rather than the client price. Both of those corrections are mine to make.

So the list below is much shorter than version 1. That is good news.

---

## What is still genuinely broken or missing

Every item below I checked against commit `4bce6fd` today.

### 1. The stylistId bug is still live in one place

`routes/dashboard.ts` was fixed. **`routes/appointments.ts` was not.**

Line 53:

```ts
appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.stylistId, user.id));
```

`appointments.stylistId` holds a `stylist_profiles.id`. `user.id` is a `users.id`. Different tables, different values, so this matches nothing and `GET /appointments` returns an empty list for every artist, every time.

Her dashboard works now. Her appointments list does not. Fix in `PATCHES.md`, patch 1.

### 2. The 18/82 rate is hardcoded in three different places

| File | What it says |
|---|---|
| `lib/escrow.ts` | `ARTIST_SHARE = 0.82`, `PLATFORM_SHARE = 0.18` |
| `routes/appointments.ts` | `ARTIST_PAYOUT_PCT = 0.82`, `PLATFORM_FEE_PCT = 0.18` |
| `routes/dashboard.ts` | inline `(a.price + a.tipAmount) * 0.82` |

Three copies of the same number under three different names. The day you change your commission, you have to remember all three, and the one you forget will quietly produce wrong numbers for months before anyone notices.

Fix: one file, `lib/money.ts`, supplied here. Patch 2.

### 3. "Released" does not mean "paid"

`payoutStatus: "released"` means the split was calculated and the money is cleared for release. It does not mean it reached the artist's bank account. There is no `paidOutAt` and no payment reference anywhere.

So your strongest claim, *"pays township beauty artists within 24 hours of every booking"*, still cannot be measured. You cannot answer "what is our on-time payout rate" from this database, and that is the number the press story and the impact narrative rest on.

Patch 3 adds `payoutDueAt`, `paidOutAt` and `payoutReference`, and patch 6 gives you the page that reports on them.

### 4. The commission rate is not stored per booking

The split amounts are stored, which is good, but not the *rate*. If you ever move from 18% to 15%, you cannot tell from the data which bookings were taken under which rate, because the percentage only exists as a constant in code.

One column, `platformFeePercent`, fixes this permanently. Patch 3.

### 5. Verification is still a sticker, not a gate

`routes/stylists.ts` line 166 still reads:

```ts
if (verified === "true") {
  profiles = profiles.filter(p => p.verified);
}
```

Unverified artists still appear in browse by default. Nothing blocks them being booked or applying to a campaign. Your exit document calls verification the moat and says never compromise. Patch 4.

### 6. No tier and no reputation score

Still zero occurrences of tier, REP or reputation anywhere in the codebase. Your Phase 3 pillar does not exist. Patch 5 plus the supplied `reputation.ts`.

### 7. No POPIA anything

Still zero occurrences of POPIA, consent, or privacy. You are storing names, phone numbers, locations and photographs of South African citizens, and your exit document says compliance is required before the first booking. Patch 7.

### 8. Campaign budgets are still free text

`casting_calls.budget` is `text`, so "R5000", "5k" and "negotiable" all sit in the same column and none of it can be totalled. Patch 8.

### 9. No foreign key on appointments.stylistId

Every other relationship in your schema has one. This column does not, which is precisely how the bug in item 1 survived. A foreign key would have made it impossible. Patch 3.

### 10. No R600 rate floor

Your green light rule says R600/hr minimum for Phase 1 onboarding, no exceptions. There is no price validation. Patch 9.

### 11. No owner finance view

There is no route that tells you GMV, commission earned, what you have paid out, or what you still owe. That is still a spreadsheet, and your exit document names spreadsheets as something that halves acquisition interest. `owner.ts` is supplied, ready to drop in.

---

## What is in this folder

| File | What to do with it |
|---|---|
| `PATCHES.md` | Nine surgical patches to existing files, each with exact before and after. |
| `new-files/money.ts` | Drop into `artifacts/api-server/src/lib/`. Single source of truth for the 18/82 split and the R600 floor. |
| `new-files/reputation.ts` | Drop into `artifacts/api-server/src/lib/`. REP score and tier calculation. |
| `new-files/owner.ts` | Drop into `artifacts/api-server/src/routes/`. Your finance view and payout run. |

---

## How to apply it

Upload this folder to your Repl and paste this to the agent:

```
I have uploaded bonisa-fixes-v2/. It was written against the current code at
commit 4bce6fd, so it should apply cleanly.

Work through PATCHES.md in order. Stop after patch 1 and tell me it is done
before continuing — that one is a live bug and I want to confirm it separately.

Patch 1: in routes/appointments.ts, the GET /appointments handler compares
appointmentsTable.stylistId against user.id. appointments.stylistId holds a
stylist_profiles.id, not a users.id, so artists get an empty list every time.
Resolve the profile by userId first, then query by profile.id. Note this was
already fixed correctly in routes/dashboard.ts — copy that approach.

Run pnpm run typecheck and confirm zero errors.
```

Then continue patch by patch. Patches 1 and 2 need no schema change and carry almost no risk. Patches 3 onwards touch the database, so take them one at a time.

---

## Suggested order

1. **Patch 1**, the live bug. Today.
2. **Patch 2**, one source of truth for the commission. Today, no risk.
3. **Patch 4**, verification gate. This is the one that most changes what Bonisa is.
4. **Patch 3 and owner.ts**, so you can actually measure the 24-hour promise.
5. **Patch 7**, POPIA, before you take a real booking.
6. Patches 5, 8, 9 when you have room.

---

*Prepared for Alwande Khoza · Bonisa · Opus Intelligence (Pty) Ltd · 14 August 2026*
