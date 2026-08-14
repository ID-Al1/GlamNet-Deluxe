import Stripe from 'stripe';
import { getStripeCredentials, getUncachableStripeClient } from './stripeClient';
import { getStripeSync } from './stripeClient';
import { fulfillCheckoutSession } from './lib/paymentHelpers';
import { db, paymentsTable, appointmentsTable } from '@workspace/db';
import { eq, and } from 'drizzle-orm';
import { logger } from './lib/logger';
import { randomUUID } from 'crypto';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const { secretKey, webhookSecret } = await getStripeCredentials();
    const stripe = new Stripe(secretKey);

    if (!webhookSecret) {
      throw new Error(
        'Webhook secret not configured. Stripe webhook requests cannot be verified. ' +
        'Ensure the Stripe integration has a webhook secret configured.'
      );
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    // Also hand to stripe-replit-sync for table sync (non-fatal)
    setImmediate(async () => {
      try {
        const sync = await getStripeSync();
        await sync.processWebhook(payload, signature);
      } catch { /* non-fatal */ }
    });

    await WebhookHandlers.handleEvent(stripe, event);
  }

  private static async handleEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
    logger.info({ type: event.type, id: event.id }, 'Processing Stripe webhook event');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== 'paid') break;
        try {
          const result = await fulfillCheckoutSession(stripe, session.id);
          if (result.alreadyExisted) {
            logger.info({ sessionId: session.id }, 'Webhook: appointment already existed (idempotent)');
          } else {
            logger.info(
              { sessionId: session.id, appointmentId: result.appointment.id },
              'Webhook: appointment created'
            );
          }
        } catch (err: any) {
          // conflict = slot taken, forbidden = wrong user — log and skip, don't crash
          if (['conflict', 'forbidden', 'bad_metadata'].includes(err.code)) {
            logger.error({ err, sessionId: session.id }, 'Webhook: fulfillment error');
          } else {
            throw err;
          }
        }
        break;
      }

      case 'checkout.session.expired': {
        // Release any pending appointment tied to this session so the slot
        // becomes available again and the customer can re-book.
        const expiredSession = event.data.object as Stripe.Checkout.Session;
        const pendingAppts = await db.select().from(appointmentsTable)
          .where(eq(appointmentsTable.stripeSessionId, expiredSession.id));
        for (const appt of pendingAppts) {
          if (appt.status === 'pending') {
            await db.update(appointmentsTable)
              .set({ status: 'cancelled' })
              .where(eq(appointmentsTable.id, appt.id));
            logger.info(
              { appointmentId: appt.id, sessionId: expiredSession.id },
              'Pending appointment cancelled — checkout session expired'
            );
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        logger.warn({ paymentIntentId: pi.id }, 'Payment intent failed');

        // Look up the checkout session to find the associated pending appointment.
        // The session carries the stripeSessionId that links back to the appointment.
        let sessionId: string | null = null;
        let appointmentFromPi: (typeof appointmentsTable.$inferSelect) | null = null;
        try {
          const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
          const session = sessions.data[0];
          if (session) {
            sessionId = session.id;
            const appts = await db.select().from(appointmentsTable)
              .where(eq(appointmentsTable.stripeSessionId, session.id));
            appointmentFromPi = appts[0] ?? null;
          }
        } catch (lookupErr) {
          logger.warn({ lookupErr, paymentIntentId: pi.id }, 'Could not look up checkout session for failed payment intent');
        }

        // Also check by payment intent ID directly (for re-linked appointments from retries)
        if (!appointmentFromPi) {
          const apptsByPi = await db.select().from(appointmentsTable)
            .where(eq(appointmentsTable.stripePaymentIntentId, pi.id));
          appointmentFromPi = apptsByPi[0] ?? null;
        }

        if (appointmentFromPi) {
          // Update appointment to cancelled so it appears in history as retryable
          if (appointmentFromPi.status === 'pending' || appointmentFromPi.status === 'confirmed') {
            await db.update(appointmentsTable)
              .set({ status: 'cancelled', stripePaymentIntentId: pi.id })
              .where(eq(appointmentsTable.id, appointmentFromPi.id));
            logger.info({ appointmentId: appointmentFromPi.id }, 'Appointment cancelled due to failed payment');
          }

          // Update the specific payment row for this payment intent to failed.
          // Scoped to stripePaymentIntentId (not appointmentId) so previous
          // succeeded rows for the same appointment are not corrupted.
          const piPayments = await db.select().from(paymentsTable)
            .where(and(
              eq(paymentsTable.appointmentId, appointmentFromPi.id),
              eq(paymentsTable.stripePaymentIntentId, pi.id),
            ));
          if (piPayments.length > 0) {
            await db.update(paymentsTable)
              .set({ status: 'failed' })
              .where(eq(paymentsTable.stripePaymentIntentId, pi.id));
          } else {
            await db.insert(paymentsTable).values({
              id: randomUUID(),
              appointmentId: appointmentFromPi.id,
              stripeSessionId: sessionId,
              stripePaymentIntentId: pi.id,
              amount: (pi.amount ?? 0) / 100,
              tipAmount: 0,
              depositAmount: 0,
              discountAmount: 0,
              couponCode: null,
              refundedAmount: 0,
              status: 'failed',
            });
            logger.info({ appointmentId: appointmentFromPi.id, paymentIntentId: pi.id }, 'Created failed payment record');
          }
        } else {
          // No appointment found — fall back to updating any payment record by PI
          await db.update(paymentsTable)
            .set({ status: 'failed' })
            .where(eq(paymentsTable.stripePaymentIntentId, pi.id));
          logger.warn({ paymentIntentId: pi.id }, 'payment_intent.payment_failed: no linked appointment found');
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
        if (!piId) break;

        const refundedAmount = charge.amount_refunded / 100;
        const isFullRefund = charge.refunded;

        const payments = await db.select().from(paymentsTable)
          .where(eq(paymentsTable.stripePaymentIntentId, piId));

        for (const payment of payments) {
          await db.update(paymentsTable)
            .set({
              refundedAmount,
              status: isFullRefund ? 'refunded' : 'partial_refunded',
            })
            .where(eq(paymentsTable.id, payment.id));
          logger.info({ paymentId: payment.id, refundedAmount, isFullRefund }, 'Payment refund recorded');
        }
        break;
      }

      default:
        logger.debug({ type: event.type }, 'Unhandled webhook event type');
    }
  }
}
