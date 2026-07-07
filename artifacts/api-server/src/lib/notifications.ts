/**
 * GlamNet Notification Service — WhatsApp via Twilio
 *
 * CHANNEL GUARDRAIL: WhatsApp Business API is the primary notification channel
 * for GlamNet. Email is NOT wired here intentionally — the business operates
 * day-to-day over WhatsApp and wants parity in-product.
 *
 * PAYFAST GUARDRAIL: No Stripe-specific logic here. This service is
 * payment-agnostic — it fires on booking events regardless of payment provider.
 *
 * Setup required:
 *   TWILIO_ACCOUNT_SID   — from console.twilio.com
 *   TWILIO_AUTH_TOKEN    — from console.twilio.com
 *   TWILIO_WHATSAPP_FROM — e.g. "whatsapp:+14155238886" (sandbox) or your
 *                          approved WhatsApp Business number
 *
 * If these env vars are not set, notifications are logged but not sent —
 * the app never fails because a notification couldn't be delivered.
 */

import { logger } from "./logger";

type NotificationEvent =
  | "booking.created"    // → stylist
  | "booking.confirmed"  // → client
  | "booking.declined"   // → client
  | "booking.completed"  // → client AND stylist (fire twice with different `to`)
  | "casting.applied";   // → brand

interface NotificationData {
  clientName?: string;
  stylistName?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  castingTitle?: string;
  applicantName?: string;
  brandName?: string;
}

function formatMessage(event: NotificationEvent, data: NotificationData): string {
  switch (event) {
    case "booking.created":
      return (
        `✨ *New booking on GlamNet!*\n\n` +
        `${data.clientName} has booked *${data.serviceName}* with you.\n` +
        `📅 ${data.date} at ${data.time}\n\n` +
        `Log in to GlamNet to confirm or manage the appointment.`
      );
    case "booking.confirmed":
      return (
        `✅ *Your booking is confirmed!*\n\n` +
        `${data.stylistName} has confirmed your *${data.serviceName}* appointment.\n` +
        `📅 ${data.date} at ${data.time}\n\n` +
        `Open GlamNet to message your artist or view details.`
      );
    case "booking.declined":
      return (
        `❌ *Booking update from GlamNet*\n\n` +
        `Unfortunately, ${data.stylistName} is unable to take your *${data.serviceName}* appointment on ${data.date} at ${data.time}.\n\n` +
        `Visit GlamNet to find another available artist.`
      );
    case "booking.completed":
      return (
        `🌟 *Appointment complete!*\n\n` +
        `Your *${data.serviceName}* session with ${data.stylistName} is marked as complete.\n\n` +
        `Leave a review on GlamNet to help other clients discover great artists.`
      );
    case "casting.applied":
      return (
        `🎬 *New casting application on GlamNet!*\n\n` +
        `*${data.applicantName}* has applied to your casting call: _${data.castingTitle}_\n\n` +
        `Log in to GlamNet to review their profile and portfolio.`
      );
    default:
      return "You have a new notification on GlamNet.";
  }
}

/**
 * Normalise a phone number to E.164 format for WhatsApp.
 * Accepts: +27 821234567, 0821234567, 27821234567
 * South African default prefix is +27 if no country code is detected.
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Already has country code (starts with 27 and is 11 digits, or starts with + prefix)
  if (raw.startsWith("+")) return "+" + digits;
  if (digits.startsWith("27") && digits.length === 11) return "+" + digits;
  // Local SA format starting with 0
  if (digits.startsWith("0") && digits.length === 10) return "+27" + digits.slice(1);
  // Bare 9-digit number (no leading 0, no country code)
  if (digits.length === 9) return "+27" + digits;
  // Already 11 digits starting with country code without +
  if (digits.length >= 10) return "+" + digits;
  return null;
}

export async function sendNotification(
  toPhone: string | null | undefined,
  event: NotificationEvent,
  data: NotificationData,
): Promise<void> {
  const body = formatMessage(event, data);

  if (!toPhone) {
    logger.info({ event, data }, "Notification skipped — recipient has no phone number on file");
    return;
  }

  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_WHATSAPP_FROM"];

  if (!sid || !token || !from) {
    logger.info(
      { event, to: toPhone, body },
      "Notification logged (Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM to enable WhatsApp delivery)"
    );
    return;
  }

  const to = normalisePhone(toPhone);
  if (!to) {
    logger.warn({ event, toPhone }, "Notification skipped — could not normalise phone to E.164");
    return;
  }

  try {
    // Dynamic import so the module loads even if twilio package is absent
    const twilio = (await import("twilio")).default;
    const client = twilio(sid, token);
    const fromFormatted = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
    await client.messages.create({
      from: fromFormatted,
      to: `whatsapp:${to}`,
      body,
    });
    logger.info({ event, to }, "WhatsApp notification sent");
  } catch (err) {
    // Non-fatal — a failed notification must never break the API response
    logger.warn({ err, event, to }, "WhatsApp notification failed — non-fatal");
  }
}
