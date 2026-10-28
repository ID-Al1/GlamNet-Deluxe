---
name: Bonisa account deletion (POPIA)
description: How "Request deletion" works, what it removes and keeps, and what still needs a human or a lawyer
type: project
---
A person (client, artist or brand, not the owner) asks from the bottom of their Profile page. It only creates a request (table account_deletion_requests, one pending per person). The owner reviews it under Owner > Deletions and approves or declines (a written reason is required and the person reads it). Nothing is deleted without the owner approving. Privacy page promises a reply within 30 days (assumption, a lawyer should confirm).

**Approval is refused** while the person has a pending or confirmed booking, money held or disputed on a booking, money still owed to the artist (ledger status due), or an open complaint. The check runs again inside the same transaction as the deletion.

**Removed (lib/accountDeletion.ts anonymiseUser):** name, email (replaced by deleted-<id>@deleted.invalid), phone, photo, business name, payment-provider customer id, referral code, password (random 64 character value), their chat words ("[Message removed]") and names on bookings, client booking notes, artist bio, links, location, ID number, safety contact, portfolio, aftercare pages, and bank details (blanked, not deleted, so the access log keeps its link). The artist profile is hidden (verified false). Account becomes suspended with anonymised_at set.

**Kept:** booking, payment, payout and complaint records (without the person's name), the bank access log, other people's messages, reviews and their text.

**Still manual:** the stored ID document file is deleted through ObjectStorageService.deleteObjectEntity; if that fails the approve reply has idDocumentDeleted false and the owner must remove the file. The owner must also delete the customer in the payment provider (Stripe now, Peach later). Other uploaded files (chat images, evidence, avatars) are not yet removed. Complaint descriptions and review text are kept; a lawyer should say whether that is acceptable.
