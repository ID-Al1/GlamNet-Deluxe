/**
 * Bonisa Notification Service — WhatsApp (Twilio) + Email (Resend)
 *
 * CHANNEL POLICY
 * --------------
 * The original version of this file was WhatsApp only, on purpose: the business
 * runs day to day on WhatsApp. That is still true for anything time-sensitive.
 *
 * Email was added for one specific reason. Phone is optional on a user record,
 * email is not. An artist can sign up, complete her profile and get verified
 * without ever giving us a phone number, and under the old rules she would have
 * been told about none of it. Her verification approval, the moment she becomes
 * bookable, would have been logged and silently dropped.
 *
 * So the rule is by event, not by preference:
 *
 *   "whatsapp"  — time-sensitive, act-now. WhatsApp if we have a phone,
 *                 email as fallback if we do not. Never both.
 *   "both"      — account and money events. These need a durable record she can
 *                 find again in three months, so they always go to email, and
 *                 also to WhatsApp if we have a number.
 *
 * A notification never breaks the API response. If a send fails, the admin
 * number is alerted so a human can follow up.
 *
 * Setup required:
 *   TWILIO_ACCOUNT_SID   — from console.twilio.com
 *   TWILIO_AUTH_TOKEN    — from console.twilio.com
 *   TWILIO_WHATSAPP_FROM — e.g. "whatsapp:+14155238886" (sandbox) or your
 *                          approved WhatsApp Business number
 *   ADMIN_WHATSAPP_PHONE — Bonisa founder/admin number, for a copy of every
 *                          casting application and for failure alerts
 *   RESEND_API_KEY       — from resend.com (free tier covers 3,000/month)
 *   EMAIL_FROM           — e.g. "Bonisa <hello@bonisa.co.za>"
 *
 * If any of these are missing, that channel logs instead of sending. The app
 * never fails because a notification could not be delivered.
 */

import { logger } from "./logger";
import { renderEmail } from "./email-templates";

export type NotificationEvent =
  // ── Bookings ──────────────────────────────────────────────────────────────
  | "booking.created"           // → artist
  | "booking.confirmed"         // → client
  | "booking.confirmed.stylist" // → artist (her own confirmation copy)
  | "booking.declined"          // → client
  | "booking.completed"         // → client AND artist
  | "message.received"          // → message recipient

  // ── Verification: the artist's path onto the platform ─────────────────────
  | "verification.submitted"    // → artist
  | "verification.approved"     // → artist
  | "verification.rejected"     // → artist

  // ── Money ─────────────────────────────────────────────────────────────────
  | "payout.released"           // → artist
  | "payout.paid"               // → artist

  // ── Casting: both sides, so nobody is left waiting in silence ─────────────
  | "casting.applied"           // → brand AND admin
  | "casting.shortlisted"       // → artist
  | "casting.accepted"          // → artist
  | "casting.declined"          // → artist

  // ── Progression ───────────────────────────────────────────────────────────
  | "tier.changed"              // → artist

  // ── Owner updates: one-to-many messages from Bonisa ───────────────────────
  | "artist.update"             // → artist
  | "artist.reminder"           // → artist or waitlist contact (automatic nudge)
  | "artist.email"              // → artist or contact (branded email the owner chose)

  // ── Brand campaigns ───────────────────────────────────────────────────────
  | "casting.invited"           // → artist (a brand invited her to a campaign)
  | "campaign.artist_accepted"  // → brand
  | "campaign.artist_declined"  // → brand
  | "campaign.cancelled"        // → artist (the brand cancelled before paying)
  | "casting.seat_offer"        // → artist (a seat opened up; first to accept gets it)
  | "campaign.artist_withdrew"  // → brand
  | "campaign.seat_filled"      // → brand
  | "campaign.seat_decision"    // → brand (less than 24 hours to go and a seat is still open)
  | "campaign.withdrawal_recorded" // → the artist who withdrew
  | "campaign.seat_refund"      // → brand
  | "campaign.cancellation_requested" // → owner
  | "campaign.funded"           // → artist (confirmed and funded)
  | "campaign.deposit_received" // → brand
  | "campaign.balance_due"      // → brand (reminder)
  | "campaign.balance_received" // → brand
  | "brand.verified"            // → brand
  | "brand.rejected";           // → brand

/**
 * Which channel each event uses.
 *
 * "whatsapp" — one channel only, email used purely as a fallback.
 * "both"     — email always sent, WhatsApp too when we have a number.
 *
 * The rule of thumb: if she might need to find it again months later, or it is
 * about her money or her standing on the platform, it goes to email.
 */
const CHANNEL_POLICY: Record<NotificationEvent, "whatsapp" | "both"> = {
  "booking.created": "whatsapp",
  "booking.confirmed": "whatsapp",
  "booking.confirmed.stylist": "whatsapp",
  "booking.declined": "whatsapp",
  "booking.completed": "whatsapp",
  "message.received": "whatsapp",
  "casting.applied": "whatsapp",

  "verification.submitted": "both",
  "verification.approved": "both",
  "verification.rejected": "both",
  "payout.released": "both",
  "payout.paid": "both",
  "casting.shortlisted": "both",
  "casting.accepted": "both",
  "casting.declined": "both",
  "tier.changed": "both",
  "artist.update": "both",
  "artist.reminder": "both",
  "artist.email": "both",

  "casting.invited": "both",
  "campaign.artist_accepted": "whatsapp",
  "campaign.artist_declined": "whatsapp",
  "campaign.cancelled": "both",
  "casting.seat_offer": "both",
  "campaign.artist_withdrew": "both",
  "campaign.seat_filled": "both",
  "campaign.seat_decision": "both",
  "campaign.withdrawal_recorded": "both",
  "campaign.seat_refund": "both",
  "campaign.cancellation_requested": "whatsapp",
  "campaign.funded": "both",
  "campaign.deposit_received": "both",
  "campaign.balance_due": "both",
  "campaign.balance_received": "both",
  "brand.verified": "both",
  "brand.rejected": "both",
};

export interface NotificationData {
  clientName?: string;
  stylistName?: string;
  artistName?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  castingTitle?: string;
  applicantName?: string;
  brandName?: string;
  senderName?: string;
  preview?: string;

  // Verification
  outstandingItems?: string[];
  rejectionReason?: string;

  // Money
  amount?: number;
  payoutDueAt?: string | null;
  payoutReference?: string | null;

  // Progression
  newTier?: string;
  previousTier?: string;
  nextGoal?: string | null;

  // Owner updates (already personalised for this artist)
  updateSubject?: string;
  updateBody?: string;

  // Brand campaigns
  eventDate?: string;
  location?: string;
  rate?: number;
  artistCount?: number;
  balanceDueDate?: string;
  balanceAmount?: number;
  otherName?: string;
  note?: string;
  seatCount?: number;
}

export interface Recipient {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}

const rand = (n?: number) => (typeof n === "number" ? `R${n.toFixed(2)}` : "the agreed amount");

// ---------------------------------------------------------------------------
// WhatsApp copy
// ---------------------------------------------------------------------------

function formatMessage(event: NotificationEvent, data: NotificationData): string {
  const who = data.artistName ?? data.stylistName ?? "there";

  switch (event) {
    case "booking.created":
      return (
        `✨ *New booking on Bonisa!*\n\n` +
        `${data.clientName} has booked *${data.serviceName}* with you.\n` +
        `📅 ${data.date} at ${data.time}\n\n` +
        `Log in to Bonisa to confirm or manage the appointment.`
      );
    case "booking.confirmed":
      return (
        `✅ *Your booking is confirmed!*\n\n` +
        `${data.stylistName} has confirmed your *${data.serviceName}* appointment.\n` +
        `📅 ${data.date} at ${data.time}\n\n` +
        `Open Bonisa to message your artist or view details.`
      );
    case "booking.confirmed.stylist":
      return (
        `✅ *Booking confirmed*\n\n` +
        `You confirmed *${data.serviceName}* for ${data.clientName}.\n` +
        `📅 ${data.date} at ${data.time}\n\n` +
        `It's on your Bonisa schedule.`
      );
    case "booking.declined":
      return (
        `❌ *Booking update from Bonisa*\n\n` +
        `Unfortunately, ${data.stylistName} is unable to take your *${data.serviceName}* appointment on ${data.date} at ${data.time}.\n\n` +
        `Visit Bonisa to find another available artist.`
      );
    case "booking.completed":
      return (
        `🌟 *Appointment complete!*\n\n` +
        `Your *${data.serviceName}* session with ${data.stylistName} is marked as complete.\n\n` +
        `Leave a review on Bonisa to help other clients discover great artists.`
      );
    case "casting.applied":
      return (
        `🎬 *New casting application on Bonisa!*\n\n` +
        `*${data.applicantName}* has applied to your casting call: _${data.castingTitle}_\n\n` +
        `Log in to Bonisa to review their profile and portfolio.`
      );
    case "message.received":
      return (
        `💬 *New message on Bonisa*\n\n` +
        `${data.senderName} sent you a message: "${data.preview}"\n\n` +
        `Open Bonisa to reply.`
      );

    case "verification.submitted":
      return (
        `📋 *Verification submitted*\n\n` +
        `Thanks ${who}, we've received your profile for review.\n\n` +
        `We check new artists within 72 hours. You'll hear from us either way.`
      );
    case "verification.approved":
      return (
        `🎉 *You're verified on Bonisa!*\n\n` +
        `Congratulations ${who}. Your profile is live.\n\n` +
        `Clients can now find and book you, and you can apply to paid brand campaigns.\n\n` +
        `Open Bonisa to check your availability is up to date.`
      );
    case "verification.rejected":
      return (
        `📋 *Verification update*\n\n` +
        `Hi ${who}, we couldn't verify your profile yet.\n\n` +
        `${data.rejectionReason ?? "A few things still need completing."}\n\n` +
        `Fix it and submit again. We're not turning you away, we just need a bit more.`
      );

    case "payout.released":
      return (
        `💰 *Payment released*\n\n` +
        `${rand(data.amount)} for *${data.serviceName}* has cleared.\n` +
        `${data.payoutDueAt ? `In your account by ${data.payoutDueAt}.\n` : ""}\n` +
        `View it on your Bonisa earnings page.`
      );
    case "payout.paid":
      return (
        `✅ *You've been paid*\n\n` +
        `${rand(data.amount)} sent for *${data.serviceName}*.\n` +
        `Reference: ${data.payoutReference ?? "see your earnings page"}\n\n` +
        `Thank you for the work.`
      );

    case "casting.shortlisted":
      return (
        `⭐ *You've been shortlisted!*\n\n` +
        `${data.brandName} has shortlisted you for _${data.castingTitle}_.\n\n` +
        `Open Bonisa. They may be in touch shortly.`
      );
    case "casting.accepted":
      return (
        `🎬 *You got the campaign!*\n\n` +
        `${data.brandName} has chosen you for _${data.castingTitle}_.\n\n` +
        `Open Bonisa for the brief and the details.`
      );
    case "casting.declined":
      return (
        `📋 *Casting update*\n\n` +
        `${data.brandName} has gone with other artists for _${data.castingTitle}_.\n\n` +
        `It happens, and it isn't a reflection on your work. New campaigns are posted regularly.`
      );

    case "tier.changed":
      return (
        `🏅 *You're now ${data.newTier} on Bonisa*\n\n` +
        `Your reputation has moved you up from ${data.previousTier}.\n\n` +
        `${data.nextGoal ?? "Keep going."}`
      );

    case "artist.update":
      return (
        `*${data.updateSubject ?? "An update from Bonisa"}*\n\n` +
        `${data.updateBody ?? ""}\n\n` +
        `Open Bonisa to see all your updates.`
      );

    case "artist.reminder":
      return `*${data.updateSubject ?? "A reminder from Bonisa"}*\n\n${data.updateBody ?? ""}`;

    case "casting.invited":
      return (
        `🎬 *You have been invited to a campaign*\n\n` +
        `${data.brandName} would like to book you for _${data.castingTitle}_.\n` +
        `📅 ${data.eventDate ?? "Date to be confirmed"}${data.location ? ` · ${data.location}` : ""}\n` +
        `💰 ${rand(data.rate)} for you. Your full rate, with no Bonisa commission taken off.\n\n` +
        `Open Bonisa to accept or decline.`
      );
    case "campaign.artist_accepted":
      return (
        `✅ *${data.artistName} accepted*\n\n` +
        `${data.artistName} will work on _${data.castingTitle}_ with you.\n\n` +
        `Open Bonisa to see your team and pay the deposit to confirm them.`
      );
    case "campaign.artist_declined":
      return (
        `📋 *${data.artistName} is not available*\n\n` +
        `${data.artistName} has declined your invitation to _${data.castingTitle}_.\n\n` +
        `Open Bonisa to invite someone else.`
      );
    case "campaign.cancelled":
      return (
        `📋 *Campaign cancelled*\n\n` +
        `${data.brandName} has cancelled _${data.castingTitle}_ before booking. Nothing is owed and nothing changes on your side.\n\n` +
        `New campaigns are posted regularly on Bonisa.`
      );
    case "campaign.funded":
      return (
        `🎉 *Confirmed and funded*\n\n` +
        `${data.brandName} has paid for _${data.castingTitle}_ and your spot is confirmed.\n` +
        `📅 ${data.eventDate ?? ""}${data.location ? ` · ${data.location}` : ""}\n` +
        `💰 ${rand(data.rate)} is held safely by Bonisa and paid to you within 24 hours of the job being confirmed complete.\n\n` +
        `Open Bonisa for the details and to message the brand.`
      );
    case "campaign.deposit_received":
      return (
        `✅ *Payment received*\n\n` +
        `We received ${rand(data.amount)} for _${data.castingTitle}_. Your ${data.artistCount ?? ""} artists are confirmed.\n` +
        `${data.balanceAmount ? `The balance of ${rand(data.balanceAmount)} is due by ${data.balanceDueDate}.\n` : ""}\n` +
        `Open Bonisa for your campaign summary.`
      );
    case "campaign.balance_due":
      return (
        `💳 *Campaign balance due*\n\n` +
        `The balance of ${rand(data.balanceAmount)} for _${data.castingTitle}_ is due by ${data.balanceDueDate}.\n\n` +
        `Open Bonisa to pay it and keep your artists confirmed.`
      );
    case "campaign.balance_received":
      return (
        `✅ *Campaign paid in full*\n\n` +
        `Thank you. We received ${rand(data.amount)} and _${data.castingTitle}_ is paid in full.\n\n` +
        `After the shoot, confirm the work in Bonisa so your artists are paid.`
      );
    case "brand.verified":
      return (
        `🎉 *${data.brandName} is verified on Bonisa*\n\n` +
        `You can now post campaigns and book verified artists.\n\n` +
        `Open Bonisa to create your first campaign.`
      );
    case "brand.rejected":
      return (
        `📋 *Brand verification update*\n\n` +
        `We could not verify ${data.brandName ?? "your brand"} yet.\n\n` +
        `${data.rejectionReason ?? "A few details still need completing."}\n\n` +
        `Update your brand profile and submit again.`
      );

    case "casting.seat_offer":
      return (
        `🚨 *A seat has opened up*\n\n` +
        `${data.brandName} needs a replacement artist for _${data.castingTitle}_.\n` +
        `📅 ${data.eventDate ?? "Date to be confirmed"}${data.location ? ` · ${data.location}` : ""}\n` +
        `💰 ${rand(data.rate)} for you. Your full rate, already paid in and held by Bonisa.\n\n` +
        `First to accept gets it. Open Bonisa to accept.`
      );
    case "campaign.artist_withdrew":
      return (
        `⚠️ *${data.artistName} can't make it*\n\n` +
        `${data.artistName} has withdrawn from _${data.castingTitle}_. The money for her seat is held safely and nothing extra is owed.\n\n` +
        `We are offering the seat to your backup applicants and matching verified artists, and the first to accept takes it. You can also choose someone yourself in Bonisa.`
      );
    case "campaign.seat_filled":
      return (
        `✅ *Seat filled*\n\n` +
        `${data.artistName} will replace ${data.otherName ?? "the artist who withdrew"} on _${data.castingTitle}_. Everything else stays the same.`
      );
    case "campaign.seat_decision":
      return (
        `⏰ *Decision needed*\n\n` +
        `_${data.castingTitle}_ is less than 24 hours away and still has ${data.seatCount ?? 1} open ${(data.seatCount ?? 1) === 1 ? "seat" : "seats"}.\n\n` +
        `Open Bonisa to go ahead with fewer artists (the open seat is refunded to you), or to ask us to cancel.`
      );
    case "campaign.withdrawal_recorded":
      return (
        `📋 *Withdrawal recorded*\n\n` +
        `You have withdrawn from _${data.castingTitle}_. ${data.note ?? ""}`
      );
    case "campaign.seat_refund":
      return (
        `💳 *Seat refund*\n\n` +
        `You are going ahead with fewer artists on _${data.castingTitle}_. We will refund ${rand(data.amount)} to the card you paid with. It can take a few days to show.`
      );
    case "campaign.cancellation_requested":
      return (
        `📣 *Cancellation requested*\n\n` +
        `${data.brandName} asks to cancel the paid campaign _${data.castingTitle}_.\n` +
        `${data.note ? `Reason: ${data.note}\n` : ""}\n` +
        `Open the owner portal, Campaigns, to review.`
      );

    default:
      return "You have a new notification on Bonisa.";
  }
}

// ---------------------------------------------------------------------------
// Email copy
//
// Plain, warm, no marketing tone. These are records she may come back to.
// ---------------------------------------------------------------------------

function formatEmail(event: NotificationEvent, data: NotificationData): { subject: string; body: string; html?: string } | null {
  const who = data.artistName ?? data.stylistName ?? "there";
  const sign = `\n\n— The Bonisa team\nbonisa.co.za`;

  switch (event) {
    // Branded templates, see email-templates.ts.
    case "verification.submitted": {
      const email = renderEmail("verification_received", { name: who, email: null, stage: "waiting_review", missing: [], fromWaitlist: false });
      return { subject: email.subject, body: email.text, html: email.html };
    }

    case "verification.approved": {
      const email = renderEmail("profile_activated", { name: who, email: null, stage: "live", missing: [], fromWaitlist: false });
      return { subject: email.subject, body: email.text, html: email.html };
    }

    case "verification.rejected":
      return {
        subject: "Your Bonisa verification needs a bit more",
        body:
          `Hi ${who},\n\n` +
          `We weren't able to verify your profile yet.\n\n` +
          `${data.rejectionReason ?? "A few things still need completing."}\n\n` +
          (data.outstandingItems?.length
            ? `Still outstanding:\n${data.outstandingItems.map((i) => `  •  ${i}`).join("\n")}\n\n`
            : "") +
          `This isn't a rejection of your work. Sort those out and submit again, ` +
          `and we'll review it within 72 hours.` +
          sign,
      };

    case "payout.released":
      return {
        subject: `Payment released: ${rand(data.amount)}`,
        body:
          `Hi ${who},\n\n` +
          `Your payment for ${data.serviceName ?? "a completed booking"} has cleared.\n\n` +
          `  Amount:  ${rand(data.amount)}\n` +
          (data.payoutDueAt ? `  With you by:  ${data.payoutDueAt}\n` : "") +
          `\nBonisa pays artists within 24 hours of a job being confirmed complete. ` +
          `If it hasn't arrived by then, reply to this email and we'll chase it.` +
          sign,
      };

    case "payout.paid":
      return {
        subject: `You've been paid: ${rand(data.amount)}`,
        body:
          `Hi ${who},\n\n` +
          `${rand(data.amount)} has been sent to you for ${data.serviceName ?? "a completed booking"}.\n\n` +
          `  Reference:  ${data.payoutReference ?? "see your earnings page"}\n\n` +
          `Keep this email for your records. Your full earnings history is on your ` +
          `Bonisa dashboard.\n\n` +
          `Thank you for the work.` +
          sign,
      };

    case "casting.shortlisted":
      return {
        subject: `Shortlisted: ${data.castingTitle}`,
        body:
          `Hi ${who},\n\n` +
          `${data.brandName} has shortlisted you for "${data.castingTitle}".\n\n` +
          `Nothing to do yet. They may contact you through Bonisa shortly. ` +
          `Worth making sure your availability is current.` +
          sign,
      };

    case "casting.accepted":
      return {
        subject: `You got it: ${data.castingTitle}`,
        body:
          `Hi ${who},\n\n` +
          `${data.brandName} has chosen you for "${data.castingTitle}".\n\n` +
          `Log in to Bonisa for the full brief, the dates and the rate. ` +
          `Campaign work counts towards your reputation on the platform.\n\n` +
          `Congratulations.` +
          sign,
      };

    case "casting.declined":
      return {
        subject: `Update on ${data.castingTitle}`,
        body:
          `Hi ${who},\n\n` +
          `${data.brandName} has gone with other artists for "${data.castingTitle}".\n\n` +
          `We tell you either way, because hearing nothing is worse than hearing no. ` +
          `It isn't a reflection on your work, and it doesn't affect your standing ` +
          `on Bonisa. New campaigns are posted regularly.` +
          sign,
      };

    case "tier.changed":
      return {
        subject: `You're now ${data.newTier} on Bonisa`,
        body:
          `Hi ${who},\n\n` +
          `Your reputation on Bonisa has moved you from ${data.previousTier} to ${data.newTier}.\n\n` +
          `This is earned from work you've actually completed here: jobs finished, ` +
          `clients who came back, reviews, and turning up on time. It isn't something ` +
          `we hand out, and it isn't something anyone can buy.\n\n` +
          (data.nextGoal ? `${data.nextGoal}\n\n` : "") +
          `Higher tiers unlock campaigns that are closed to lower ones.` +
          sign,
      };

    case "artist.update":
      return {
        subject: data.updateSubject ?? "An update from Bonisa",
        body:
          `${data.updateBody ?? ""}\n\n` +
          `You can find this and every other update from us under Updates in the Bonisa app.` +
          sign,
      };

    case "artist.reminder":
      return {
        subject: data.updateSubject ?? "A reminder from Bonisa",
        body: `${data.updateBody ?? ""}` + sign,
      };

    case "casting.invited":
      return {
        subject: `${data.brandName} invited you to ${data.castingTitle}`,
        body:
          `Hi ${who},\n\n` +
          `${data.brandName} would like to book you for "${data.castingTitle}".\n\n` +
          `  Date:      ${data.eventDate ?? "to be confirmed"}\n` +
          (data.location ? `  Where:     ${data.location}\n` : "") +
          `  Your rate: ${rand(data.rate)}\n\n` +
          `That is your full rate. On brand campaigns the brand pays Bonisa's fee on top, so nothing is taken off what you are paid.\n\n` +
          `Open Bonisa to accept or decline.` +
          sign,
      };
    case "campaign.artist_accepted":
      return {
        subject: `${data.artistName} accepted: ${data.castingTitle}`,
        body:
          `${data.artistName} has accepted your invitation to "${data.castingTitle}".\n\n` +
          `Open Bonisa to see your team. Once you pay the deposit, your artists are confirmed.` +
          sign,
      };
    case "campaign.artist_declined":
      return {
        subject: `${data.artistName} is not available: ${data.castingTitle}`,
        body:
          `${data.artistName} has declined your invitation to "${data.castingTitle}".\n\n` +
          `Open Bonisa to invite someone else.` +
          sign,
      };
    case "campaign.cancelled":
      return {
        subject: `Campaign cancelled: ${data.castingTitle}`,
        body:
          `Hi ${who},\n\n` +
          `${data.brandName} has cancelled "${data.castingTitle}" before booking any artists. ` +
          `Nothing is owed and nothing changes on your side.\n\n` +
          `New campaigns are posted regularly on Bonisa.` +
          sign,
      };
    case "campaign.funded":
      return {
        subject: `Confirmed and funded: ${data.castingTitle}`,
        body:
          `Hi ${who},\n\n` +
          `${data.brandName} has paid for "${data.castingTitle}", and your spot is confirmed.\n\n` +
          `  Date:      ${data.eventDate ?? ""}\n` +
          (data.location ? `  Where:     ${data.location}\n` : "") +
          `  Your rate: ${rand(data.rate)}\n\n` +
          `Your payment is held safely by Bonisa and paid to you within 24 hours of the job being confirmed complete. ` +
          `Nothing is taken off your rate.\n\n` +
          `Open Bonisa for the details, and to message the brand.` +
          sign,
      };
    case "campaign.deposit_received":
      return {
        subject: `Payment received: ${data.castingTitle}`,
        body:
          `We have received ${rand(data.amount)} for "${data.castingTitle}". ` +
          `Your ${data.artistCount ?? ""} artists are confirmed.\n\n` +
          (data.balanceAmount
            ? `The balance of ${rand(data.balanceAmount)} is due by ${data.balanceDueDate}, three days before the event. ` +
              `We will remind you. If it is not paid by then, your artists may be released.\n\n`
            : `The campaign is paid in full.\n\n`) +
          `After the event, confirm in Bonisa that the work was done, and your artists are paid.` +
          sign,
      };
    case "campaign.balance_due":
      return {
        subject: `Balance due by ${data.balanceDueDate}: ${data.castingTitle}`,
        body:
          `The balance of ${rand(data.balanceAmount)} for "${data.castingTitle}" is due by ${data.balanceDueDate}.\n\n` +
          `Please pay it in Bonisa to keep your artists confirmed for the event.` +
          sign,
      };
    case "campaign.balance_received":
      return {
        subject: `Paid in full: ${data.castingTitle}`,
        body:
          `Thank you. We received ${rand(data.amount)} and "${data.castingTitle}" is now paid in full.\n\n` +
          `After the event, confirm in Bonisa that the work was done. Your artists are paid within 24 hours of both sides confirming.` +
          sign,
      };
    case "brand.verified":
      return {
        subject: `${data.brandName} is verified on Bonisa`,
        body:
          `${data.brandName} has been verified.\n\n` +
          `You can now post campaigns, invite verified artists and book your team. ` +
          `Your artists are paid their full rate, and Bonisa's fee is added on top, so you always see the exact total before you pay.` +
          sign,
      };
    case "brand.rejected":
      return {
        subject: `Your Bonisa brand verification needs a bit more`,
        body:
          `We could not verify ${data.brandName ?? "your brand"} yet.\n\n` +
          `${data.rejectionReason ?? "A few details still need completing."}\n\n` +
          `Update your brand profile and submit it again. We review every submission within 72 hours.` +
          sign,
      };

    case "casting.seat_offer":
      return {
        subject: `A seat has opened up: ${data.castingTitle}`,
        body:
          `Hi ${who},\n\n` +
          `${data.brandName} needs a replacement artist for "${data.castingTitle}".\n\n` +
          `  Date:      ${data.eventDate ?? "to be confirmed"}\n` +
          (data.location ? `  Where:     ${data.location}\n` : "") +
          `  Your rate: ${rand(data.rate)}\n\n` +
          `That is your full rate, already paid in and held safely by Bonisa. The first artist to accept gets the seat.\n\n` +
          `Open Bonisa to accept.` +
          sign,
      };
    case "campaign.artist_withdrew":
      return {
        subject: `${data.artistName} can't make it: ${data.castingTitle}`,
        body:
          `${data.artistName} has withdrawn from "${data.castingTitle}".\n\n` +
          `The money for her seat is held safely, and nothing extra is owed. We are offering the seat to your backup applicants and to matching verified artists, and the first to accept takes it. ` +
          `You can also choose someone yourself in Bonisa at any time.\n\n` +
          `If no replacement is found by 24 hours before the event, you decide: go ahead with one fewer artist (the seat is refunded to you), or ask us to cancel.` +
          sign,
      };
    case "campaign.seat_filled":
      return {
        subject: `Seat filled: ${data.castingTitle}`,
        body:
          `${data.artistName} will replace ${data.otherName ?? "the artist who withdrew"} on "${data.castingTitle}". ` +
          `Everything else stays the same, and you pay nothing extra for the swap.` +
          sign,
      };
    case "campaign.seat_decision":
      return {
        subject: `Decision needed: ${data.castingTitle}`,
        body:
          `"${data.castingTitle}" is less than 24 hours away and still has ${data.seatCount ?? 1} open ${(data.seatCount ?? 1) === 1 ? "seat" : "seats"}.\n\n` +
          `Open Bonisa to choose:\n` +
          `  - Go ahead with fewer artists. The open seat is refunded to you.\n` +
          `  - Ask us to cancel the campaign.\n\n` +
          `We are still offering the seat to matching artists, so it may yet be filled.` +
          sign,
      };
    case "campaign.withdrawal_recorded":
      return {
        subject: `Your withdrawal from ${data.castingTitle}`,
        body:
          `Hi ${who},\n\n` +
          `You have withdrawn from "${data.castingTitle}". ${data.note ?? ""}\n\n` +
          `You are not paid for this job, and the brand's money for your seat stays safely held for a replacement.` +
          sign,
      };
    case "campaign.seat_refund":
      return {
        subject: `Seat refund: ${data.castingTitle}`,
        body:
          `You are going ahead with fewer artists on "${data.castingTitle}".\n\n` +
          `We will refund ${rand(data.amount)} to the card you paid with. It can take a few days to appear on your statement.` +
          sign,
      };

    default:
      // Booking-flow events are WhatsApp-first. No email version needed unless
      // there is no phone on file, in which case the WhatsApp copy is reused.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * Normalise a phone number to E.164 for WhatsApp.
 * Accepts: +27 821234567, 0821234567, 27821234567
 * South African default prefix is +27 if no country code is detected.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return "+" + digits;
  if (digits.startsWith("27") && digits.length === 11) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+27" + digits.slice(1);
  if (digits.length === 9) return "+27" + digits;
  if (digits.length >= 10) return "+" + digits;
  return null;
}

async function sendWhatsApp(toPhone: string, event: NotificationEvent, body: string): Promise<boolean> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_WHATSAPP_FROM"];

  if (!sid || !token || !from) {
    logger.info({ event, to: toPhone, body }, "WhatsApp logged (Twilio not configured)");
    return false;
  }

  const to = normalisePhone(toPhone);
  if (!to) {
    logger.warn({ event, toPhone }, "WhatsApp skipped — could not normalise phone to E.164");
    return false;
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(sid, token);
    const fromFormatted = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
    await client.messages.create({ from: fromFormatted, to: `whatsapp:${to}`, body });
    logger.info({ event, to }, "WhatsApp notification sent");
    return true;
  } catch (err) {
    logger.warn({ err, event, to }, "WhatsApp notification failed — escalating to admin");
    await alertAdminOfFailure(event, to, err);
    return false;
  }
}

async function sendEmail(
  toEmail: string,
  event: NotificationEvent,
  subject: string,
  body: string,
  html?: string,
): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];

  if (!apiKey || !from) {
    logger.info({ event, to: toEmail, subject, body }, "Email logged (Resend not configured — set RESEND_API_KEY and EMAIL_FROM)");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [toEmail], subject, text: body, ...(html ? { html } : {}) }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend responded ${res.status}: ${detail}`);
    }

    logger.info({ event, to: toEmail }, "Email notification sent");
    return true;
  } catch (err) {
    logger.warn({ err, event, to: toEmail }, "Email notification failed — escalating to admin");
    await alertAdminOfFailure(event, toEmail, err);
    return false;
  }
}

/**
 * Channel-aware send. Prefer this for anything new.
 *
 * Pass whatever contact details you have. It works out which channels to use
 * from the event, and it never throws.
 */
export async function notify(
  to: Recipient,
  event: NotificationEvent,
  data: NotificationData = {},
): Promise<Array<"email" | "whatsapp">> {
  const delivered: Array<"email" | "whatsapp"> = [];
  const policy = CHANNEL_POLICY[event] ?? "whatsapp";
  const waBody = formatMessage(event, data);
  const emailContent = formatEmail(event, data);

  if (!to.phone && !to.email) {
    logger.info({ event, data }, "Notification skipped — recipient has no phone or email on file");
    return delivered;
  }

  if (policy === "both") {
    // Email always. This is a record she may need again.
    if (to.email && emailContent) {
      if (await sendEmail(to.email, event, emailContent.subject, emailContent.body, emailContent.html)) delivered.push("email");
    }
    if (to.phone) {
      if (await sendWhatsApp(to.phone, event, waBody)) delivered.push("whatsapp");
    }
    return delivered;
  }

  // policy === "whatsapp": one channel, with email as a fallback so nothing is
  // silently dropped for an artist who never gave us a phone number.
  if (to.phone) {
    const sent = await sendWhatsApp(to.phone, event, waBody);
    if (sent) return ["whatsapp"];
  }

  if (to.email) {
    const subject = emailContent?.subject ?? "You have an update on Bonisa";
    const body = emailContent?.body ?? waBody.replace(/\*/g, "");
    if (await sendEmail(to.email, event, subject, body, emailContent?.html)) delivered.push("email");
  }
  return delivered;
}

/** Send one already-rendered branded email. Never throws; true when delivered. */
export async function sendBrandedEmail(toEmail: string, email: { subject: string; text: string; html: string }): Promise<boolean> {
  return sendEmail(toEmail, "artist.email", email.subject, email.text, email.html);
}

/**
 * Original signature, kept so every existing call site keeps working unchanged.
 * New code should call notify() instead, so email fallback is available.
 */
export async function sendNotification(
  toPhone: string | null | undefined,
  event: NotificationEvent,
  data: NotificationData,
): Promise<void> {
  await notify({ phone: toPhone ?? null }, event, data);
}

/**
 * Best-effort alert to the Bonisa admin number when a notification fails.
 * Deliberately minimal and never recursive, so a broken Twilio connection
 * cannot loop back on itself.
 */
async function alertAdminOfFailure(
  failedEvent: NotificationEvent,
  failedTo: string,
  err: unknown,
): Promise<void> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_WHATSAPP_FROM"];
  const adminPhone = process.env["ADMIN_WHATSAPP_PHONE"];

  if (!adminPhone) {
    logger.warn({ failedEvent, failedTo }, "No ADMIN_WHATSAPP_PHONE set — failure alert not sent");
    return;
  }
  if (!sid || !token || !from) return;

  const to = normalisePhone(adminPhone);
  if (!to) return;

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(sid, token);
    const fromFormatted = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
    const errMessage = err instanceof Error ? err.message : String(err);
    await client.messages.create({
      from: fromFormatted,
      to: `whatsapp:${to}`,
      body:
        `⚠️ *Bonisa notification failed*\n\n` +
        `Event: ${failedEvent}\n` +
        `Intended recipient: ${failedTo}\n` +
        `Reason: ${errMessage}\n\n` +
        `Please follow up with this person directly.`,
    });
  } catch (escalationErr) {
    logger.error({ escalationErr, failedEvent, failedTo }, "Admin failure alert also failed to send");
  }
}
