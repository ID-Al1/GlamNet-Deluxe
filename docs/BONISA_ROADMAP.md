# Bonisa roadmap and masterclass checklist

**What this is:** one page that says what is finished, what is next, and how to know each task is truly done. It replaces guessing with a list you can tick.

**How to read it:** think of Bonisa as a house being built for opening night. Phase 1 is the foundation and walls. Each later phase is another floor. You do not paint the top floor while the foundation still has cracks.

**How it was made:** from `replit.md`, `docs/BONISA_BUILD_SPEC.md`, the agent memory notes and a read of the actual code. Nothing here was tested in a running app, so every "Done" below means "the code exists", not "a real person has tried it". Phase 4 is where we test for real.

Status key: [x] done, [~] built but needs checking, [ ] not started.

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
