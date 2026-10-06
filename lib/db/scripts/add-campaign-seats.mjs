import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    ALTER TABLE casting_calls
      ADD COLUMN IF NOT EXISTS seats_funded integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS seat_wave integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS seat_wave_at timestamp,
      ADD COLUMN IF NOT EXISTS seat_decision_notified_at timestamp,
      ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamp,
      ADD COLUMN IF NOT EXISTS cancellation_reason text;
    ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS seat_open boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS refund_due_amount real NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS refunded_at timestamp,
      ADD COLUMN IF NOT EXISTS refund_reference text;
    -- campaigns paid before seats existed: the seats are the jobs they already have
    UPDATE casting_calls c SET seats_funded = (
      SELECT count(*) FROM appointments a WHERE a.campaign_id = c.id AND a.status IN ('confirmed','completed')
    ) WHERE c.seats_funded = 0 AND c.status IN ('deposit_paid','fully_paid');
    CREATE TABLE IF NOT EXISTS campaign_seat_events (
      id text PRIMARY KEY,
      casting_id text NOT NULL REFERENCES casting_calls(id),
      kind text NOT NULL,
      stylist_profile_id text,
      stylist_name text NOT NULL DEFAULT '',
      other_name text,
      severity text,
      hours_before real,
      reason text,
      amount real,
      created_at timestamp NOT NULL DEFAULT now()
    );
    DO $$ BEGIN
      ALTER TABLE campaign_seat_events ADD CONSTRAINT campaign_seat_events_kind_check
        CHECK (kind IN ('withdrew','filled','given_up'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS campaign_seat_events_casting_idx ON campaign_seat_events(casting_id, created_at);
    CREATE INDEX IF NOT EXISTS campaign_seat_events_stylist_idx ON campaign_seat_events(stylist_profile_id, created_at) WHERE kind = 'withdrew';
  `);
  await pool.query("COMMIT");
  console.log("Campaign seat columns and events table created.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
