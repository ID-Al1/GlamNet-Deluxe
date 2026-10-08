# Bonisa roadmap and masterclass checklist

**What this is:** one page that says what is finished, what is next, and how to know each task is truly done. It replaces guessing with a list you can tick.

**How to read it:** think of Bonisa as a house being built for opening night. Phase 1 is the foundation and walls. Each later phase is another floor. You do not paint the top floor while the foundation still has cracks.

**How it was made:** from `replit.md`, `docs/BONISA_BUILD_SPEC.md`, the agent memory notes and a read of the actual code. Nothing here was tested in a running app, so every "Done" below means "the code exists", not "a real person has tried it". Phase 4 is where we test for real.

Status key: [x] done, [~] built but needs checking, [ ] not started.

---

## Part A. The business roadmap (people, money, paperwork, events)

The app is only one wall of the house. These are the other walls. Last updated 8 October 2026.

### Latest updates (8 October 2026)

- **Ambassador "Oshobi Girl" is confirmed.** She has the link and is testing the app. Her notes are the first outside feedback Bonisa gets, so collect them in one place
- **Peach Payments is delayed.** The link they needed was only sent on Monday 5 October, so the 10 day wait starts then. Calendar days: answer around 15 October. Working days: around 19 October. Confirm which one Peach means
- **Payments are not settled**, so no real money moves yet and the Stripe or Peach decision stays open
- **Legal is still not started**

### The five streams

**1. Launch events with Favour (event coordinator for Hayden's team)**
- [ ] Favour confirms the new dates for the rescheduled events
- [ ] Agree what Bonisa gets: a stand, a slot on stage, a mention, or promo girls only
- [ ] Agree the promo girls' role: handing out a card or QR code that sends people to Bonisa
- [ ] Lock the launch line. Options on the table: "Honey, it's time to show up with Bonisa" or "Honey, it's time for you to meet Bonisa". Pick one and use it everywhere
- [ ] Printed QR code goes to a simple page that works on a phone
- [ ] Decide what a person does after scanning (sign up as a client, or apply as an artist)

Analogy: the event is opening night. The promo girls are the people handing out invitations. Invitations are useless if the doors are not ready, so the date of the event decides the deadline for everything else.

**2. Amali: getting verified artists now**
- [ ] Give Amali a clear job: find artists, walk them through signup and verification, chase missing documents
- [ ] One shared list (name, city, speciality, Instagram, status: contacted, applied, verified)
- [ ] A weekly number for Amali, agreed with you (suggestion: 10 new applications a week)
- [ ] A short script and a one page guide so every artist hears the same pitch
- [ ] Amali sees the owner queue status so she can tell artists where they are stuck

Why now: verification is the slowest step in the whole business. Starting it early means the artists are ready when payments and events are.

**3. Campus ambassadors for makeup artists**
- [ ] Pick 1 or 2 campuses or training academies to pilot
- [ ] Define what an ambassador does (spreads the word, helps classmates apply) and what they get (commission, free tier, a title, a reference letter)
- [ ] Write a one page ambassador pitch
- [ ] Track which artists came from which ambassador, so you can reward fairly
- [ ] Review after 4 weeks: how many applied, how many passed verification

**4. Money: Peach Payments and the Opus bank account**
- [ ] Chase Peach Payments for a date and for what they need from Opus Intelligence (Pty) Ltd
- [ ] Confirm the Opus bank account will receive client payments, and how artists get paid out
- [ ] Ask Peach in writing: do they support holding money until the work is confirmed, and splitting 82% artist and 18% Bonisa?
- [ ] Ask Peach about fees, payout timing and how the "paid within 24 hours" promise works
- [ ] Decision for you and Hayden: **our rules currently say Stripe only.** If Peach replaces Stripe, that rule must be changed on purpose, in writing, before anyone builds it. The payment code was kept in its own corner so a swap is possible, but it is still real work
- [ ] No real customer money flows until this is settled

**5. Legal paperwork (not started)**
- [ ] Find who writes it: a lawyer, or a reputable template provider reviewed by a lawyer
- [ ] Privacy policy (POPIA)
- [ ] Terms for clients
- [ ] Terms for artists, including the 18% commission and how disputes work
- [ ] Ambassador agreement (if they are paid)
- [ ] Event and promo girl agreement with Favour's side, if money or branding is involved
- [ ] Consent wording for ID documents and bank details
- [ ] Who is the Information Officer for POPIA (a named person)

### What blocks what

Think of it as a row of dominoes:

1. **Legal documents** must be done before any real booking.
2. **Peach Payments** must be settled before any real money moves.
3. **Verified artists** must exist before an event, or the people who scan have nobody to book.
4. **The event** is the loudest moment, so it needs 1, 2 and 3 to be ready.

Work backwards from the event date: that is the one date nobody on our side controls.

### Draft timeline (for the conversation with Hayden)

I do not know the event dates or Peach's date yet, so this uses weeks counted from the day you and Hayden agree. Change the numbers once Favour and Peach answer.

| When | What happens | Who |
|---|---|---|
| **Week 0** | Agree roles and this plan. Get Favour's event dates. Chase Peach. Start the legal search. Decide who owns what | You, Hayden |
| **Weeks 1 to 2** | Amali starts outreach. Ambassador pitch written. Legal drafts commissioned. Opus bank details sent to Peach. Pick the launch line | Amali, you, Hayden |
| **Weeks 3 to 4** | Campus pilot starts. First 10 artists verified. Legal drafts reviewed. Peach answer expected, decide Stripe or Peach | All |
| **Weeks 5 to 6** | Legal live in the app (signup consent, policy pages). Payment tested end to end with a small real payment and a refund. 25 verified artists | Hayden (app), you |
| **Weeks 7 to 8** | First real bookings from friendly clients. Fix what breaks. Reach 40 to 50 verified artists. Event materials ready (QR, cards, landing page) | All, Favour |
| **Event week** | Launch with the promo girls. Only go if the 3 gates below are green | Favour, all |
| **After the event** | Measure: signups, bookings, artists paid inside 24 hours. Then decide on the PWA and the mobile app | You, Hayden |

**Three gates before the event (all must be yes):**
- [ ] Legal is live in the app
- [ ] Real payments work end to end
- [ ] At least 30 verified artists are visible and bookable (50 is the goal)

If the event date arrives before a gate is green, it is better to move the launch moment than to launch without it. A first impression with no artists or broken payments cannot be taken back.

### Numbers to sanity check
These are my assumptions, not facts. Adjust them with Hayden.
- Not every applicant passes verification. If about 6 in 10 pass, you need roughly 80 applications to reach 50 verified artists
- 10 applications a week for 8 weeks gives about 80
- Ambassadors can add to that, so Amali's number could drop to about 6 a week once they are active

### Questions for you and Hayden
1. What are Favour's dates, and what does Bonisa get at the events?
2. Is Peach replacing Stripe, or running alongside it for now?
3. Who writes the legal documents, and what is the budget?
4. Is Amali full time or part time, and what is her weekly target?
5. Which campuses first, and what do ambassadors earn?
6. Hayden's newer version of the app: can you share the link, so this roadmap reflects the real current state? This file was built from the earlier Replit project only, so the status ticks in Part B may be out of date

---

## Part B. The product roadmap (the app itself)

The sections below track the app. If Hayden's newer version is ahead of this one, tick the boxes to match it.

---

## The one rule behind every task

**One task. One check. Stop and report.**
A task is finished only when:

- [ ] `pnpm run typecheck` shows zero errors
- [ ] The check written under the task passes when you actually try it
- [ ] The rule is enforced by the server, not just by hiding a button
- [ ] Nothing in a `generated/` folder was edited by hand
- [ ] Any database change has a script in `lib/db/scripts/`
- [ ] Pushed to GitHub, then reported in plain words

Analogy: a builder saying "the wall is up" is a claim. Pressing on the wall is the evidence.

---

## Phase 1. The foundation (built)

These are the walls of the house. They exist in the code today.

- [x] Verification gate: unverified artists hidden and blocked
- [x] 18% platform and 82% artist split stored on each booking
- [x] Escrow: money held until the work is confirmed
- [x] Double booking prevention
- [x] Private identity verification flow
- [x] Owner Command Centre phases 1 to 5 (registry, payments, complaints, bank details, management flags)
- [x] Manual artist payout ledger
- [x] Complaints and disputes
- [x] Account suspension
- [x] Real time chat
- [x] Role based profiles for client, artist, brand

**Check this phase:** [ ] Walk one fake test booking from signup to payout on a test Stripe account and write down anything that breaks.

---

## Phase 2. The legal gate (do before the first real booking)

This is the building permit. Without it you cannot legally let guests in.

- [ ] Privacy policy page, linked in the footer and at signup
- [ ] Terms of service page
- [ ] POPIA consent box at signup (a tick the person must choose, saved with a date)
- [ ] Written data retention position (how long you keep ID documents and chats, and how someone asks to delete their data)
- [ ] Complaints and data request contact shown in the app
- [ ] Stripe account switched from test to live, with a real small payment tried and refunded

**Done when:** a new person cannot finish signing up without seeing and accepting the privacy policy, and the acceptance is stored.

Why first: the build spec calls POPIA a hard gate. Nothing in the code mentions it yet.

---

## Phase 3. Tidy the house (small, safe fixes)

Rule from your notes: **never rename and build in the same pass.** Do these as their own small tasks.

- [ ] Finish the GlamNet to Bonisa rename (about 140 files still mention it). Do this alone, then confirm everything still runs
- [ ] Keep the `glamnet_auth` login key until you are ready to log everyone out once, on purpose
- [ ] Rename `conversations.stylistId` to `stylistUserId` (it holds a user id, unlike every other table)
- [ ] Make campaign budgets real numbers instead of free text
- [ ] Artist plans: R99 Basic and R199 Pro, with what each one unlocks written down first
- [~] Confirm the booking record holds commission and payout fields (they look present, verify with one booking)
- [ ] Swap every user-facing "stylist" for "artist"

**Done when:** searching the user-facing screens for "GlamNet" and "stylist" finds nothing.

---

## Phase 4. Prove each screen does its one job

Each screen has one job from the build spec. For each, open it on a phone sized window (360px wide) and tick the check.

**Browse artists**
- [ ] Says in words that everyone is verified
- [ ] Card order: name, verified badge and tier, jobs completed, specialty and area
- [ ] No price on the card
- [ ] An unverified artist cannot appear by any trick in the web address

**Artist profile**
- [ ] Top third shows name, verified mark, specialty, area, jobs completed, REP score, time on Bonisa
- [ ] No Rand amount above the fold
- [ ] Order: Standing, Work, Services with prices, Book button

**Artist dashboard**
- [ ] Money owed to her is the biggest number, with the arrival time in words
- [ ] Earnings shown are her 82%, never the client price
- [ ] Tier progress bar with the next goal
- [ ] Next booking shows what she takes home

**Verification checklist (artist)**
- [ ] Opens with what verification unlocks
- [ ] Submit only turns on when everything is complete
- [ ] She is never blocked without a visible way forward

**Owner queue**
- [ ] Shows who is waiting and for how long
- [ ] Anyone waiting 3 days or more is flagged
- [ ] Rejecting needs a written reason, and she sees it word for word
- [ ] No approving in bulk

**Casting calls**
- [ ] Artists see every call and whether they qualify yet
- [ ] Brands see applicants with verification, tier and jobs completed
- [ ] Every applicant is told the outcome (shortlisted, accepted or passed over)

**Brand rules to spot check everywhere**
- [ ] No fake or placeholder artists, ratings, prices or photos
- [ ] No emoji, only Lucide line icons
- [ ] Colours come from the design tokens, none typed in by hand
- [ ] Greeting is Bonjour, Bon après-midi or Bonsoir with the first name below

---

## Phase 5. Get the First 50 artists

The build spec says features wait until the model is proven. This phase is the proof.

- [ ] List your first 50 target artists (name, city, speciality, how you know them)
- [ ] Write the invite message once and reuse it
- [ ] Onboard 5 artists by hand, watch them use it, write down every place they got stuck
- [ ] Fix the top 3 sticking points before inviting more
- [ ] Reach 50 verified artists
- [ ] Reach 10 real paid bookings
- [ ] Pay one artist inside 24 hours and screenshot it (this is your strongest promise)
- [ ] Keep the 72 hour rule: no application waits longer than 3 days

**Done when:** 50 verified artists and 10 completed paid bookings, with every artist paid on time.

---

## Phase 6. The home screen icon (PWA)

The cheap middle step. Like putting a shop sign up before building the second shop.

- [ ] Web app manifest
- [ ] App icons at every size, from the existing three petal mark (never recoloured or redrawn)
- [ ] Service worker so it opens like an app
- [ ] Move login storage into one single file (this makes the later app switch easy)

**Done when:** an artist can add Bonisa to her phone home screen and open it full screen.

---

## Phase 7. The real mobile app (only after Phase 5)

Do not start this until the First 50 are taking bookings. A store listing for an empty marketplace is a bad first impression, and reviews are permanent.

- [ ] Apple Developer account (about USD 99 a year)
- [ ] Google Play account (about USD 25 once)
- [ ] Expo app in `artifacts/mobile` that reuses the API, the contract and the generated hooks
- [ ] Swap `localStorage` login for secure phone storage (`expo-secure-store`)
- [ ] Build artist screens first, client screens second
- [ ] Privacy policy link and data disclosure for both stores
- [ ] Test every rule from Phase 4 again inside the app
- [ ] Submit to both stores

What carries over for free: the server, database, rules and API. What gets rebuilt: the screens.

---

## Phase 8. Grow (only when the model is proven)

- [ ] Artist plans live and charging
- [ ] Brand campaigns with real budgets
- [ ] Referral and team booking review
- [ ] Reports for you: bookings, money held, money paid, complaints

---

## The "never do this" list

- No second payment provider. Stripe only
- No fake, sample or placeholder content, even for demos
- No commission under 18%
- No salons as the main profile, only individual artists
- No comparing Bonisa to Gumtree or classifieds
- No feature that does not help onboard the First 50, take verified bookings, or pay artists on time

---

## Your next three moves

1. Phase 2, the legal gate. It blocks everything else.
2. Run the Phase 1 test booking so you know what really works.
3. Phase 3, the rename, as its own pass.

*Maintained alongside `replit.md` and `docs/BONISA_BUILD_SPEC.md`.*
