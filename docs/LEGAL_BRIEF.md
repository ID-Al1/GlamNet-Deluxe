# Bonisa legal brief

Prepared 21 October 2026 for Alwande and Haiden, to hand to a South African attorney. This is a briefing, not legal advice. Facts marked (code) were read from the app's database design. Facts marked (to confirm) need an owner answer.

## 1. What Bonisa is

South Africa's verified professional network for beauty artists. Artists build a verified profile, take bookings and apply to brand campaigns. Clients book a verified artist. Brands staff campaigns from a verified pool. Unverified artists cannot be listed, booked or apply to campaigns (enforced on the server).

Target date to be live with legal documents in the app: **Monday 2 November 2026**. Public launch event: **Saturday 14 November 2026**.

## 2. Who is who (to confirm)

| Question | Current understanding |
|---|---|
| Legal owner | Opus Intelligence (Pty) Ltd, CIPC registered (to confirm current details) |
| Brand | Bonisa. Open: trading name under Opus, or a separate company (to confirm) |
| Bank account | Opus account (to confirm) |
| Payment provider | Peach Payments replaces Stripe. Not yet confirmed or connected |
| POPIA Information Officer | Not yet named |
| Artists | Independent contractors, one profile per person, not salons |
| Ambassadors ("Show Me Girls") | Contractors paid per result, not employees (design stage) |
| Amali | Helper on content, not an employee |

## 3. How money moves

1. Client books a verified artist and pays the full price into a held balance (code: escrow).
2. The money stays held until both the client and the artist confirm the work was done (code: dual confirmation).
3. Bonisa keeps **18%**. The artist receives **82%**. The split is stored on the booking record and never recalculated (code).
4. The artist is to be paid within **24 hours** of release (code: payout window).
5. Today payouts are recorded and marked paid by the owner by hand (code: payout ledger).
6. The app also records tips, deposits, discounts and refunds (code).
7. Onboarding floor: services must be at least R600 per hour (code).

Questions this raises for the lawyer: see section 6.

## 4. Personal information the app holds (code)

| Group | Data | Notes |
|---|---|---|
| All users | Name, email, phone, password (stored as a hash), avatar, business name, referral code, account status | Phone numbers must be unique |
| Artists | Location and area, bio, specialty, Instagram, website, availability, whether they do house calls, portfolio images, services and prices | Public profile |
| Artists (private) | ID number and ID document | Private, owner access only. Never shown publicly |
| Artists (private) | Bank name, account holder, account number, bank verification status | Masked in normal views. Owner reveals are logged |
| Clients | Booking notes, appointment history, payment references, chat messages and shared media | Appointment notes may contain personal detail |
| Complaints | Description, evidence uploads, owner notes, case history | Private |
| Reviews | Rating, text, photos or video | Public |
| Brands | Brand name, campaigns, briefs, budgets | |
| Referrals | Who referred whom | |
| Payments | Amounts and provider references | Provider references currently point to Stripe and will change |

Not yet in place (code): any consent record, privacy policy, retention rule, deletion process or data breach procedure.

## 5. Documents needed

**Must be live in the app by 2 November (before any real booking or ID collection)**

1. Privacy policy (POPIA): what is collected, why, how long it is kept, who it is shared with (payment provider, hosting, storage), cross-border transfer if servers are abroad, and how to ask for access, correction or deletion.
2. Consent at signup: a tick box the person must choose, saved with the date. Separate consent for ID documents and bank details. Marketing consent kept separate.
3. Terms of use for clients.
4. Artist agreement: independent contractor status, verification rules, what "verified" means, 18% commission, payout timing, conduct, suspension and termination, a rule against taking Bonisa clients off the platform, content licence for portfolio images, insurance and liability.
5. Booking, cancellation and refund policy, including when money is held and released, no shows, partial completion and how disputes are decided.
6. Company details shown on the site (registered name, number, address, contact).

**Needed before the 14 November event (target 9 November)**

7. Ambassador (Show Me Girl) agreement: what she earns, what she may say, how she treats people's details, and tracking consent.
8. Event and promo agreement with Favour's side: who pays, branding ownership, responsibility for promo staff.
9. Model or image release for any photos or video used in content.
10. Trademark check and registration for the name and logo.

**Later**

11. Brand and campaign terms. 12. Cookie notice. 13. Data breach plan. 14. Reviews policy. 15. Model agreement (when the model portal is built).

## 6. Questions for the lawyer

1. Does holding client money until the work is confirmed make Bonisa a regulated financial activity, or does using the payment provider's split and settlement keep it out? What does the provider need to see?
2. Trading name versus a separate company: which is better for the contract with the payment provider, the bank and the artists?
3. What must the Information Officer registration involve, and who should it be?
4. What exactly may Bonisa say when it calls an artist "verified", and what must the checks be to support that claim?
5. How do we keep artists genuinely independent contractors, including Show Me Girls paid per result?
6. Home visits: who is liable if something goes wrong at a client's home, and should artists carry insurance?
7. How should Bonisa treat under 18 users?
8. What retention period should apply to ID documents, bank details, chats and complaint evidence?
9. How should the commission appear on invoices and does VAT apply to the 18%? (Accountant to confirm.)
10. Are the cancellation and refund rules compliant with consumer protection law?

## 7. Work plan to 2 November

| By | Step | Owner |
|---|---|---|
| Thu 22 Oct | Decide trading name versus separate company. Pick the lawyer or provider. Send this brief | Alwande and Haiden |
| Mon 26 Oct | First drafts of documents 1 to 6 | Lawyer |
| Wed 28 Oct | Review round. Answer questions the lawyer raises | Alwande and Haiden |
| Fri 30 Oct | Final texts approved | Alwande and Haiden |
| Sat 31 Oct to Sun 1 Nov | Pages and consent box added to the app, tested on a phone | Haiden |
| Mon 2 Nov | Live | |
| Mon 9 Nov | Documents 7 to 10 signed or ready | Lawyer and Alwande |

If a lawyer cannot turn drafts around by 26 October, use a reviewed template for the privacy policy and general terms, and keep the lawyer for the artist agreement, refund policy and the money question.

## 8. Still to decide or confirm

- Trading name or separate company
- Information Officer
- Cash, points or discount for Show Me Girl credit, and the levels
- Whether the payment provider (Peach) changes the refund and hold wording
- Which app version is the main one, since the documents and consent box must live in it
