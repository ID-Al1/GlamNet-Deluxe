# Bonisa model portal

Built from the "Model Brand & Collaboration System" design brief. This file says what exists, what does not, and what still needs a decision. It sits beside `BONISA_BUILD_SPEC.md` and follows its rules (server enforces everything, no fake data, one migration script per schema change).

## Deploying this

1. Run the migration once against the live database: `pnpm --filter @workspace/db run migrate:model-portal:dev`. It is safe to run twice. It adds the `model` role, nine tables, and the Bonisa ID and Spotlight columns. Any model already verified is numbered in the order they were verified.
2. Restart the API server. The web app needs a normal build.
3. Existing artist, client and brand features are untouched. Until the migration runs, only the new model screens fail; nothing existing depends on the new tables.

## Who can do what (all enforced in the API, not only the screens)

| Role | Can | Cannot |
|---|---|---|
| Visitor | Browse the talent directory, a listed profile, open opportunities, About | See anything a model has not published. Contact details, ID, bank details are not in any public response. |
| Model | Edit own profile, photos, visibility, channels. Save, apply to, withdraw from opportunities. | Send enquiries to other models, open another model's records, owner routes, brand routes. Apply while unverified. |
| Brand | Post opportunities, see and respond to applicants for their own listings only. Send booking enquiries. | See another brand's listings' applicants (looks like "not found"). See any model contact details. |
| Owner | Review the model registry, open full records (audited), verify or reject with a written reason, read the audit log, close reported listings. | Nothing is hidden from the owner, so every sensitive view is written to the audit log first. |

Public visibility rule: a model appears in the directory only when **published and verified and not suspended**. Unverified models are hidden, the same as artists. Fields, photos and channels are private until the model switches each one on. Directory search only matches fields the model has made public, so a hidden city cannot be discovered by searching for it.

## Screen map

Public: `/talent`, `/talent/:id`, `/opportunities`, `/opportunities/:id`, `/about`.
Model workspace: `/workspace` (Overview), `/workspace/portfolio`, `/brand`, `/opportunities`, `/applications`, `/campaigns`, `/earnings`, `/contracts`, `/settings`.
Brand: `/brand/opportunities` (post, close, review applicants, shortlist, accept, pass).
Owner: `/owner/models` (queue, review, verify or reject), `/owner/oversight` (reported listings, access log).

## Data model

`model_profiles`, `model_photos` (front, left, right, full length, editorial), `model_social_links`, `model_enquiries`, `opportunities`, `opportunity_applications`, `saved_opportunities`, `opportunity_reports`, `audit_events` (append only). Schema: `lib/db/src/schema/models.ts`. Migration: `lib/db/scripts/add-model-portal.mjs`. Public responses are built field by field in `artifacts/api-server/src/lib/modelDto.ts`, so a new column cannot leak by accident.

Audit events are written for: publishing, visibility changes, photo changes, verification requests and decisions, every owner view of a model record or photo, applications, brand decisions, and opportunity reports. For owner views the audit row is written before data is returned.

## What is live

Public directory and profile, per-field and per-photo visibility, four-digital capture flow with editorial portraits, My Brand (identity, goals, rate guide, channels with source and date labels), opportunities with every material term shown, apply / save / withdraw / report, brand posting and applicant decisions (the model always sees the outcome), verification queue with the 72 hour flag and mandatory written rejection reason, audit log.

## Comp card, Bonisa ID and Spotlight

- **Comp card** (`/talent/:id/card`): the four digitals in identical frames, name, category, Bonisa ID, a few facts, and the verified date. Built only from the public profile, so a private photo or field can never appear on it. "Print or save as PDF" uses the browser print dialog and fits one A4 page. No rates or contact details are on it.
- **Bonisa ID** (for example `BM-0042`): issued by the server at the moment of verification, from a database sequence, and never reused. Unverified and rejected models have none. It is shown on directory cards, profiles and the comp card.
- **Spotlight**: an editorial pick made by the owner for a verified model, with an optional line of up to 140 characters. Picks appear first in the directory under a heading that says it is not a ranking and not based on views. Only verified models can be picked, a pick disappears from public view if the model unpublishes, and every add and removal is in the audit log. Nothing is computed from popularity.

## What is deliberately not live (labelled on screen)

- **Campaign workspace and statuses.** An accepted application is shown as "accepted, not yet an agreement". The planned path is shown as a plan, not as tracking.
- **Earnings.** No payments are processed or tracked, nothing is called escrow or guaranteed. Needs the payment-tracking decision below.
- **Contracts and permissions.** The screen lists what every agreement will record. Template wording needs review by a South African attorney before any real use.
- **Platform fee.** Every listing says no fee has been set. Nothing is calculated.
- **Account closure and data requests (POPIA).** Needs a process and a support contact before real use.
- **Social analytics.** Audience numbers are typed in by the model and labelled as such. No platform is connected.
- **Team campaigns, invitations to talent, negotiation of terms, MFA, roles beyond a single owner.**

## Decisions still needed (from section 13 of the brief)

1. Platform fee model and who pays it.
2. Whether models show public rates or only quote privately. Built so a model can show a "starting rate" if they switch it on, off by default.
3. Whether campaign payments are tracked by hand first or through a provider.
4. Whether audience numbers stay manual or connect to the platforms.
5. What the verification badge means. Today it means "Bonisa reviewed the profile and four digitals". No ID document is collected for models.
6. Final legal wording.

## Things found in the existing code that need attention (not changed here)

- Passwords are stored as an unsalted HMAC with a fallback secret (`glamnet_secret_key`) if `JWT_SECRET` is unset. Sign-in tokens never expire and live in `localStorage`. Both should be fixed before real money moves.
- The owner is a single account identified by an email in `OWNER_EMAIL`. There are no admin roles or MFA, which the brief asks for.
- The upload registry that ties an upload to its user is in memory, so it resets on restart and does not work across several servers. Fine for one server, a risk when scaling.
- The `/casting` routes were open to any signed-in user to edit or delete. Fixed in an earlier commit.
- 29 screens used a toast library whose display was never mounted, so their messages were invisible. Mounted in this change.

## Not tested in the build environment

Photo upload and display need the Replit object storage. The build environment did not have it, so the upload request, the upload itself and the image streaming were not exercised end to end. The screens handle the failure with a message and a "Photo unavailable" placeholder. Test uploads once on a real deployment before announcing.
