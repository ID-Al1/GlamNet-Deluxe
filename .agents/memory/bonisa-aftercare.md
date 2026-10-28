---
name: Bonisa Aftercare
description: Verified artists share aftercare instruction pages by link; how it works, its safety rules, and what is not built
type: project
---
Approved by Alwande on 2026-10-28 as an extension of Bonisa, not a separate brand. A verified artist makes a page (from a starter template per service), previews, ticks "I have reviewed these instructions", publishes, and shares the link by WhatsApp or copy. Her client opens /a/<token> on a phone with no login.

**Rules to keep:**
- Table aftercare_pages (migration lib/db/scripts/add-aftercare.mjs, new table only). Public address uses publicToken (22 random characters), never the page id.
- Content is plain text blocks (heading, paragraph, list) and is never rendered as HTML. Links must be https. Limits live in artifacts/api-server/src/lib/aftercareContent.ts.
- Server enforces ownership (another artist's page is a 404), verified-only create, edit, publish, copy. Taking a page down works even if unverified.
- The open endpoint GET /api/public/aftercare/:token returns only title, category, blocks, rebookingUrl, artist name and profile id. Unpublished, unverified and suspended artists all return 404. It is rate limited (60 per minute per IP, in memory) and sent with noindex and no-store.
- Editing a live page needs the review tick again. Starter wording (lib/aftercareTemplates.ts) is general guidance and needs Alwande's read before launch.
- The open page lives outside the normal app shell in App.tsx, before the AppLayout route.

**Not built on purpose:** images (the upload endpoint has no file type or size limits; add a banner image only with server checks), automatic WhatsApp sending, any charge or subscription, medical advice.
