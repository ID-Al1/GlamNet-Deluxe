# Patch 10 — Artist notifications

Replaces `artifacts/api-server/src/lib/notifications.ts` and wires up nine new events.

---

## Why email, when the file says not to

The existing file has a deliberate guardrail: *"Email is NOT wired here intentionally — the business operates day-to-day over WhatsApp."* That decision was right for bookings and it stays right.

Here is why it does not hold for everything.

**Phone is optional on a user record. Email is not.** Look at the users table: `email` is `notNull().unique()`, `phone` is nullable. So an artist can sign up, build her profile, get verified and become bookable without ever giving you a number.

Under the old rules, `sendNotification` would hit this line:

```ts
if (!toPhone) {
  logger.info(..., "Notification skipped — recipient has no phone number on file");
  return;
}
```

Her verification approval, the single most important message she will ever receive from Bonisa, gets written to a log file and dropped. She finds out she is live by checking the app on a hunch.

That is not hypothetical. Of the two artist profiles in your database right now, **one has no phone number**, and it is yours.

So the rule is by event, not by preference:

- **`"whatsapp"`** — time-sensitive, act-now. New booking, confirmation, message received. WhatsApp if there is a number, email only as a fallback so nothing is silently dropped. Never both.
- **`"both"`** — account standing and money. Verification, payouts, tier changes, casting outcomes. These always go to email because she may need to find them again in three months, and also to WhatsApp when there is a number.

Bookings stay exactly as they are. The guardrail is respected where it earns its keep.

---

## The nine new events

### Verification, her path onto the platform

| Event | Goes to | Why |
|---|---|---|
| `verification.submitted` | Artist | "We got it, 72 hours." Removes the silence after she hits submit. |
| `verification.approved` | Artist | The one you asked for. She is live and bookable. |
| `verification.rejected` | Artist | With the specific outstanding items, framed as "not yet" rather than "no". |

Now that patch 4 makes verification a gate, this stops being nice-to-have. An unverified artist is invisible in the product. If she is not told when that changes, she has no way of knowing she is live.

### Money

| Event | Goes to | Why |
|---|---|---|
| `payout.released` | Artist | Her money has cleared, and when it will land. |
| `payout.paid` | Artist | Sent, with the reference, as a record she can keep. |

The email for `payout.released` states the 24-hour promise in plain words and tells her to reply if it does not arrive. That turns a marketing claim into something she can hold you to, which is the point.

### Casting, closing the loop

| Event | Goes to | Why |
|---|---|---|
| `casting.shortlisted` | Artist | |
| `casting.accepted` | Artist | |
| `casting.declined` | Artist | |

Right now she applies to a campaign and **hears nothing, ever**. The brand gets notified, you get notified, she does not. She is the one who took the time to apply.

The declined email says it plainly: *"We tell you either way, because hearing nothing is worse than hearing no."* An artist who is ignored twice stops applying, and then stops opening the app.

### Progression

| Event | Goes to | Why |
|---|---|---|
| `tier.changed` | Artist | She moved up, what it unlocks, and what is next. |

Wire this once patch 5 exists. A tier nobody is told about does no work.

---

## How to apply

**1. Replace the file.** Drop `notifications.ts` over `artifacts/api-server/src/lib/notifications.ts`.

Every existing call site keeps working. `sendNotification(phone, event, data)` still exists with the same signature and now just forwards to the new channel-aware `notify()`. Nothing to change in `appointments.ts`, `casting.ts` or `messages.ts`.

**2. Add two secrets in Replit:**

```
RESEND_API_KEY   — from resend.com, free tier covers 3,000 emails/month
EMAIL_FROM       — e.g. Bonisa <hello@bonisa.co.za>
```

Resend is already in your Phase 2 budget at R0 to R500. Until these are set, emails are logged rather than sent, and nothing breaks.

**3. Wire the new events.** Each is one call at a point that already exists.

**Verification submitted** — in `stylists.ts`, the verification submit handler:

```ts
await notify(
  { phone: user.phone, email: user.email, name: user.name },
  "verification.submitted",
  { artistName: profile.name },
);
```

**Verification approved and rejected** — wherever an admin flips `verified`. If there is no admin route yet, this is the moment to add one, because right now the only way to verify an artist is to edit the database by hand and she is told nothing.

```ts
await notify(
  { phone: artistUser.phone, email: artistUser.email },
  "verification.approved",
  { artistName: profile.name },
);
```

**Payout released** — in `escrow.ts` or wherever `payoutStatus` becomes `"released"`:

```ts
await notify(
  { phone: artistUser.phone, email: artistUser.email },
  "payout.released",
  {
    artistName: profile.name,
    serviceName: appt.serviceName,
    amount: appt.artistPayoutAmount,
    payoutDueAt: appt.payoutDueAt?.toLocaleDateString("en-ZA") ?? null,
  },
);
```

**Payout paid** — in the `mark-paid` handler from `owner.ts`, once patch 3 lands.

**Casting outcomes** — in `casting.ts`, wherever a `castingApplications.status` changes. Note this needs a route: brands currently have no way to shortlist, accept or decline an applicant. The status column exists and defaults to `"pending"`, and nothing ever moves it. So the loop is not just unclosed, it cannot currently be closed at all.

**Tier changed** — in the reputation recalculation, only fire when the tier actually differs from before.

---

## One thing to build alongside this

There is no admin route for verifying an artist. The `verificationStatus` enum has `none`, `pending` and `verified`, and there is no endpoint that moves anyone between them.

So today the flow is: an artist completes her profile, submits, and then somebody edits Postgres by hand. With patch 4 live, that hand edit is the difference between her being invisible and being bookable.

Worth adding a small owner-only route: list pending artists, approve or reject with a reason, and fire the notification. It slots naturally next to `owner.ts` and it is maybe forty lines.

---

## What I did not change

- Booking notification copy. It is good and it works.
- The admin failure escalation. Escalating a failed send to your WhatsApp instead of quietly logging it was the right call, and it now covers email failures too.
- The South African phone normalisation. It handles `0821234567`, `+27821234567` and bare nine-digit numbers correctly.

---

*Prepared for Alwande Khoza · Bonisa · Opus Intelligence (Pty) Ltd · 15 August 2026*
