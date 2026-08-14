---
name: Bonisa mockup redesign lessons
description: How the mobile-mockup redesign was reconciled with real app logic; pitfalls for future visual overhauls.
---

- Rule: when restyling to match a mockup, keep all working logic (queries, mutations, routes) and re-skin the presentation only. Design subagents tend to replace live data with the mockup's static content — always audit for hardcoded dates, names, ratings, and dead buttons after a delegated redesign.
- **Why:** an Aug 2026 mockup redesign silently gutted the booking flow (7-step Stripe checkout), the client dashboard (confirm-work/dispute/review actions, WhatsApp notifications), and the browse page's artist listing; all had to be restored by merging original logic back under the new visual language.
- **How to apply:** the original pre-redesign booking page is preserved in `attached_assets/book-page-original-logic.tsx.txt`. Booking dates render as horizontal pills (next 60 days, filtered by stylist availability). Browse (/stylists) supports `q`/`search`/`specialty` URL params with client-side filtering. Bottom tab nav: Home→/dashboard, Bookings→/payments. Static "Style Inspiration" imagery on profiles is decorative and deliberately not labeled "Portfolio".
