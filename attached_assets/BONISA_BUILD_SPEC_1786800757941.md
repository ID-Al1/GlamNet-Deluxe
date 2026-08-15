# Bonisa build spec

**This file lives in the repo at `docs/BONISA_BUILD_SPEC.md` and is the source of truth for what gets built.** `replit.md` says what Bonisa is and what the rules are. This says what the screens do and how a task is considered finished.

If a request conflicts with this document, stop and ask. Do not quietly pick one.

---

## Part 1 — Why we are strict about this

Bonisa is heading for the App Store and Google Play. That is not a "later" detail, it changes what today's code has to look like.

**The rule that follows from it:** every rule enforced in a screen has to be re-enforced in every other client that talks to this API. A native app is a second client. A rule that lives in a React component protects the web and nothing else.

So:

> **Business rules live on the server. Screens only display them.**

When the verification gate was added, hiding the Book button would have looked fine on web and been wide open in the mobile app. It was enforced in the API instead, so the mobile app inherits it for free. That is the standard for everything from here.

Concretely, none of these may ever live only in the frontend:

- Who is visible, bookable, or eligible for a campaign
- Any percentage, fee, price floor or payout calculation
- Who may see, edit or approve anything
- Any status transition

The frontend may hide a button for tidiness. It may never be the only thing stopping an action.

---

## Part 2 — What each screen leads with

The product is verified professional identity. Every screen has one job, and the job is not "get to checkout faster."

### Browse / Find Artists

**Leads with:** the fact that everyone here is verified. Say it in words on the screen, not just as a badge.

**Card order, top to bottom:** name, then verified badge and tier, then jobs completed on Bonisa, then specialty and area. Rating appears but never as the headline. Price does not appear on the browse card at all.

**Forbidden:** price as a primary field, star rating as the leading signal, any unverified artist appearing for any reason.

**Why:** a star rating is the Gumtree signal and a competitor reproduces it in a week. Jobs completed on Bonisa do not travel when she leaves. Leading with the copyable signal makes us a directory.

**Done when:** an unverified artist cannot appear here through any query parameter, and a card shows verification and tier above the fold.

---

### Artist profile

**Leads with:** who she is. Name, verified mark, specialty, area. Then a row of three earned credentials: jobs completed, REP score, time on Bonisa.

**Then, in order:** a Standing block (identity verified and when, tier and what earned it, repeat client rate, on-time record), then Work (portfolio), then Services with prices, then the booking action at the bottom.

**Forbidden:** price above the fold. A profile that reads as a listing.

**Why:** price belongs at the point of booking, not the point of meeting. LinkedIn does not show a day rate before it shows you a person. Leading with a rate turns a professional into a quote.

**Done when:** a stranger can read the top third and know she is a verified professional with a track record, without seeing a number in Rand.

---

### Artist dashboard

**Leads with money owed to her, and when it lands.** A single large figure, then the deadline in plain words: "In your account by tomorrow, 14:32."

**Then:** this month and lifetime earnings, both her share after fees, never the client price. Then her tier with a progress bar and the specific next goal. Then her next booking with what she takes home. Then campaigns open to her.

**Forbidden:** showing the client price as her earnings. A dashboard that is only a calendar.

**Why:** "paid within 24 hours" is the strongest claim Bonisa has and it currently exists only in a press release. On her home screen it becomes a promise she can watch us keep, and that is what makes her recommend us to other artists. The tier bar is what makes finishing the next job here rather than off-platform worth it.

**Done when:** she can see what she is owed, when it arrives, and what the next rung is, without tapping anything.

---

### Verification checklist (artist)

**Leads with:** what verification unlocks, not what she is missing.

**Then:** the checklist with what is done and what is outstanding, and a submit action that only enables when it is complete.

**Forbidden:** blocking her without showing a route through. Framing it as failure.

**Why:** since verification is a gate, an unverified artist is invisible. If she does not know exactly how to become visible, she leaves.

---

### Owner queue

**Leads with:** who is waiting, and how long they have been waiting.

**Anyone waiting three days or more is flagged.** The operations doc says no application sits unanswered past 72 hours, so the screen holds us to our own rule.

Rejection requires a written reason, which she receives word for word.

**Forbidden:** approving in bulk without seeing the profile. A reject with no reason.

---

### Casting calls

**For the artist:** every call visible, with a clear marker for whether she is eligible yet and what tier it needs. Not hidden, because a locked door she can see is a reason to climb.

**For the brand:** applicants with verification, tier and jobs completed. Budgets as numbers.

**Non-negotiable:** an applicant always finds out the outcome. Shortlisted, accepted or passed over. Silence after applying is the fastest way to lose an artist.

---

## Part 3 — What we do not build

Straight from the strategy red lights, restated so nobody has to go looking:

- Anything that positions Bonisa against Gumtree, Bark, or a classifieds directory
- Any second payment provider. Stripe only
- Any fake, seeded, sample or placeholder content, anywhere, ever, including demos shown to investors
- Salons as the primary entity. Bonisa lists individuals
- A commission below 18% to win artists
- Features before the model is proven. If it does not help onboard the First 50, take verified bookings, or pay an artist on time, it waits

---

## Part 4 — The native app

### Where it stands

React is pinned to 19.1.0 in `pnpm-workspace.yaml` specifically for Expo compatibility, so the workspace anticipates this. Nothing else exists yet: no `app.json`, no `eas.json`, no Expo package, no PWA manifest.

### What carries over, honestly

| Layer | Reuse | Why |
|---|---|---|
| API server | 100% | A native app is just another client of the same API |
| Database and business logic | 100% | Same reason, provided rules stay server-side |
| `lib/api-spec` (OpenAPI) | 100% | The contract does not care what renders it |
| `lib/api-zod` | 100% | Plain Zod, no DOM |
| `lib/api-client-react` | Most of it | Generated hooks use fetch and TanStack Query, both of which run in React Native. The custom fetch wrapper may need the base URL handled differently |
| Auth logic | Nearly all | Except `localStorage`, which does not exist in React Native. Swap for `expo-secure-store`, which is better anyway since a JWT in localStorage is readable by any script |
| **Screens and components** | **None** | Tailwind, shadcn and every `div` are web-only. The UI is rebuilt in React Native primitives |

So: the whole back half carries over, the visual layer does not. That is normal and it is not wasted work. What matters is that the *decisions* carry over, which is what Part 2 of this document exists to preserve.

### What this changes about today

1. **Server-side enforcement is now doubly important.** Covered in Part 1.
2. **Do not over-invest in web-only visual polish** until the flows are settled. Get the screens right in structure, then build them twice.
3. **`localStorage` is a migration cost.** Every place it is used is a place the mobile app will need a different answer. Keep them few and in one file.
4. **Design mobile-first at 360px.** Every screen should already work at the narrowest phone width, because that is what the native app will be.
5. **A PWA is the cheap interim step.** A manifest, icons and a service worker would let artists add Bonisa to a home screen and use it like an app, with no store submission, no review, and no second codebase. Worth doing before the Expo build, not instead of it.

### Order, when the time comes

1. PWA manifest and icons. Days, not weeks. Artists get a home screen icon now.
2. Expo app in `artifacts/mobile`, sharing `lib/api-spec`, `lib/api-zod` and `lib/api-client-react`.
3. Artist-side screens first. She is the one who needs it on her phone all day. Clients can use the web for longer than artists can.
4. Then client-side.
5. Store submission needs: an Apple Developer account at USD 99/year, a Google Play account at USD 25 once, app icons at every size from the existing mark, a privacy policy URL, which POPIA requires anyway, and a data-collection disclosure for both stores.

**Do not start the Expo app until the First 50 are onboarded and taking bookings on the web.** A store listing for an empty marketplace is a wasted first impression, and app store reviews are permanent.

---

## Part 5 — How work gets done

This section exists because of what went wrong, not in theory. Every rule below is here because it already cost us something today.

### One task per instruction

A prompt with two numbered parts loses one of them. This happened twice today: patch 4 lost its part (e), which left unverified artists visible on the client dashboard and addable to paid team bookings, and a later prompt silently dropped a fix entirely.

**One task. One acceptance check. Stop and report.**

### The spec must be in the workspace

When `PATCHES.md` was not uploaded, the agent rebuilt the patch from a chat description and produced something close but not the same, which is how the gaps appeared.

**If a task references a document, that document is in the repo before the task starts.** That is why this file lives in `docs/`.

### Never hand-edit generated output

`lib/api-zod/src/generated/` and `lib/api-client-react/src/generated/` are produced from `lib/api-spec/openapi.yaml`. A hand edit survives until the next codegen run and then vanishes, taking the feature with it and leaving no trace of why.

**Change the spec. Run codegen. Never the file.**

### Schema changes need a migration file

A manual `ALTER TYPE` against the live database works until someone restores a backup or spins up a test database, and then a value silently does not exist.

**Every schema change ships with a migration script in `lib/db/scripts/`.**

### Definition of done

A task is finished only when all of these are true:

- [ ] `pnpm run typecheck` returns **zero** errors, not "no new errors"
- [ ] The acceptance check in the spec is met, tested, not assumed
- [ ] Any rule is enforced server side, not by hiding a control
- [ ] No generated file was hand-edited
- [ ] Any schema change has a migration script
- [ ] Committed and **pushed to GitHub**
- [ ] Reported with what changed and what was checked

Zero is the standard, not "no new errors." The moment there is a background of 47 errors, nobody can see the one that matters, and that is exactly the state this project was in this morning.

### Verification

Every push is read against the actual code, not the summary. Today that caught four things a summary would have hidden: a dropped patch part, a hand-edited generated file, an ungated door, and a page that was described as built and did not exist.

**A summary is a claim. The code is the evidence.**

---

*Bonisa · Opus Intelligence (Pty) Ltd · maintained alongside `replit.md`*
