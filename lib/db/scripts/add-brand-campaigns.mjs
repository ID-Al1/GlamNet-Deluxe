import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    ALTER TABLE casting_calls
      ADD COLUMN IF NOT EXISTS artists_needed integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS rate_per_artist real NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS event_date text,
      ADD COLUMN IF NOT EXISTS event_time text NOT NULL DEFAULT '09:00',
      ADD COLUMN IF NOT EXISTS event_duration_minutes integer NOT NULL DEFAULT 480,
      ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
      ADD COLUMN IF NOT EXISTS balance_reminder_sent_at timestamp;
    ALTER TABLE casting_applications
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'applied',
      ADD COLUMN IF NOT EXISTS responded_at timestamp;
    ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS campaign_id text,
      ADD COLUMN IF NOT EXISTS fee_mode text NOT NULL DEFAULT 'commission';
    CREATE TABLE IF NOT EXISTS brand_profiles (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_name text NOT NULL DEFAULT '',
      registration_number text,
      vat_number text,
      website text,
      billing_address text,
      verification_status text NOT NULL DEFAULT 'none',
      submitted_at timestamp,
      verified_at timestamp,
      rejection_reason text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS brand_profiles_user_unique ON brand_profiles(user_id);
    DO $$ BEGIN
      ALTER TABLE brand_profiles ADD CONSTRAINT brand_profiles_status_check
        CHECK (verification_status IN ('none','pending','verified'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS campaign_payments (
      id text PRIMARY KEY,
      casting_id text NOT NULL REFERENCES casting_calls(id),
      kind text NOT NULL,
      amount real NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      stripe_session_id text UNIQUE,
      stripe_payment_intent_id text,
      created_at timestamp NOT NULL DEFAULT now(),
      paid_at timestamp
    );
    DO $$ BEGIN
      ALTER TABLE campaign_payments ADD CONSTRAINT campaign_payments_kind_check
        CHECK (kind IN ('deposit','balance','full'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE campaign_payments ADD CONSTRAINT campaign_payments_status_check
        CHECK (status IN ('pending','paid','failed','expired'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS campaign_payment_lines (
      id text PRIMARY KEY,
      campaign_payment_id text NOT NULL REFERENCES campaign_payments(id) ON DELETE CASCADE,
      appointment_id text NOT NULL REFERENCES appointments(id),
      amount real NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS campaign_payment_lines_unique ON campaign_payment_lines(campaign_payment_id, appointment_id);
    CREATE INDEX IF NOT EXISTS appointments_campaign_idx ON appointments(campaign_id) WHERE campaign_id IS NOT NULL;
  `);
  await pool.query("COMMIT");
  console.log("Brand campaign tables and columns created.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
