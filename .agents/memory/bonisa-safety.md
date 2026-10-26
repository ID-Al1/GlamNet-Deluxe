---
name: Bonisa artist safety tools
description: The trusted-contact safety feature for artists, its limits, and what is deliberately not built
type: project
---
Artists (Merveille and Lebohang asked for this) can save one trusted contact (name and phone, private, stylist_profiles.safety_contact_*). On a booking the Safety button opens WhatsApp with the client's details, shares a one-time location link, and offers one-tap calls to the contact, police 10111 and emergency 112. All of it runs on the artist's own phone through wa.me and tel: links. Bonisa does not track her and does not message anyone.

**Rules:**
- The client's name and phone reach the artist only for a paid, confirmed booking, from 24 hours before until 12 hours after (constants in lib/bookingPolicy.ts). This matches the chat rule that contact details wait for a paid booking.
- The trusted contact is never returned by any public or other-user endpoint.
- Changing what is collected means bumping PRIVACY_POLICY_VERSION in both artifacts/glamnet/src/lib/legal.ts and routes/auth.ts and updating the privacy page.

**Not built on purpose:** client ID check, automatic check-ins or alerts ("are you safe?"), continuous live tracking. Those need an SMS or WhatsApp provider (Twilio and Resend are not configured yet) and legal and POPIA review.
