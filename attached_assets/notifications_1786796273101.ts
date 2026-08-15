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
  | "tier.changed";             // → artist

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

    default:
      return "You have a new notification on Bonisa.";
  }
}

// ---------------------------------------------------------------------------
// Email copy
//
// Plain, warm, no marketing tone. These are records she may come back to.
// ---------------------------------------------------------------------------

function formatEmail(event: NotificationEvent, data: NotificationData): { subject: string; body: string } | null {
  const who = data.artistName ?? data.stylistName ?? "there";
  const sign = `\n\n— The Bonisa team\nbonisa.co.za`;

  switch (event) {
    case "verification.submitted":
      return {
        subject: "We've received your Bonisa profile",
        body:
          `Hi ${who},\n\n` +
          `Thanks for submitting your profile for verification.\n\n` +
          `We review new artists within 72 hours, and we'll email you either way. ` +
          `If anything is missing we'll tell you exactly what, so you can fix it and submit again.` +
          sign,
      };

    case "verification.approved":
      return {
        subject: "You're verified on Bonisa",
        body:
          `Hi ${who},\n\n` +
          `Your profile has been verified. You're live on Bonisa.\n\n` +
          `What that means:\n` +
          `  •  Clients can find you in search and book you directly\n` +
          `  •  You can apply to paid brand campaigns\n` +
          `  •  Your verified badge appears on your profile\n\n` +
          `Only verified artists appear on Bonisa, so this badge is the thing that ` +
          `sets you apart from a listings site. It stays with your profile.\n\n` +
          `Two things worth doing now: check your availability is current, and add ` +
          `a few more pieces to your portfolio. Artists with fuller portfolios get ` +
          `noticeably more profile views.\n\n` +
          `Welcome in.` +
          sign,
      };

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
function normalisePhone(raw: string): string | null {
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
      body: JSON.stringify({ from, to: [toEmail], subject, text: body }),
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
): Promise<void> {
  const policy = CHANNEL_POLICY[event] ?? "whatsapp";
  const waBody = formatMessage(event, data);
  const emailContent = formatEmail(event, data);

  if (!to.phone && !to.email) {
    logger.info({ event, data }, "Notification skipped — recipient has no phone or email on file");
    return;
  }

  if (policy === "both") {
    // Email always. This is a record she may need again.
    if (to.email && emailContent) {
      await sendEmail(to.email, event, emailContent.subject, emailContent.body);
    }
    if (to.phone) {
      await sendWhatsApp(to.phone, event, waBody);
    }
    return;
  }

  // policy === "whatsapp": one channel, with email as a fallback so nothing is
  // silently dropped for an artist who never gave us a phone number.
  if (to.phone) {
    const sent = await sendWhatsApp(to.phone, event, waBody);
    if (sent) return;
  }

  if (to.email) {
    const subject = emailContent?.subject ?? "You have an update on Bonisa";
    const body = emailContent?.body ?? waBody.replace(/\*/g, "");
    await sendEmail(to.email, event, subject, body);
  }
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
  return notify({ phone: toPhone ?? null }, event, data);
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
