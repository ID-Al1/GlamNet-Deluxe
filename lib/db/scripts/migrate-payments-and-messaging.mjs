import pg from "pg";

/**
 * Repeatable migration for payment records and messaging state.
 *
 * Usage:
 *   DATABASE_URL=... node lib/db/scripts/migrate-payments-and-messaging.mjs
 */
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("BEGIN");

  await client.query(`
    DO $$ BEGIN
      CREATE TYPE payment_status AS ENUM (
        'succeeded',
        'refunded',
        'partial_refunded',
        'failed',
        'pending'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS payments (
      id text PRIMARY KEY,
      appointment_id text REFERENCES appointments(id),
      stripe_session_id text UNIQUE,
      stripe_payment_intent_id text,
      amount real NOT NULL,
      tip_amount real NOT NULL DEFAULT 0,
      deposit_amount real NOT NULL DEFAULT 0,
      discount_amount real NOT NULL DEFAULT 0,
      coupon_code text,
      refunded_amount real NOT NULL DEFAULT 0,
      status payment_status NOT NULL DEFAULT 'succeeded',
      created_at timestamp NOT NULL DEFAULT now()
    );

    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS client_last_read_at timestamp,
      ADD COLUMN IF NOT EXISTS stylist_last_read_at timestamp,
      ADD COLUMN IF NOT EXISTS client_typing_until timestamp,
      ADD COLUMN IF NOT EXISTS stylist_typing_until timestamp;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS media_url text;
  `);

  await client.query("COMMIT");
  console.log("Payments and messaging migration complete.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}