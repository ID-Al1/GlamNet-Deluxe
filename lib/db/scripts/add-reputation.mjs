import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: databaseUrl });

// Additive only. Nothing is dropped or rewritten, so it can be run again safely.
// Rollback (if ever needed): drop the new tables and the added columns below.
try {
  await pool.query("BEGIN");
  await pool.query(`
    ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS cancelled_by text,
      ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
      ADD COLUMN IF NOT EXISTS cancel_notice_hours real,
      ADD COLUMN IF NOT EXISTS no_show boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS safety_reminder_sent_at timestamp;
    ALTER TABLE stylist_profiles ADD COLUMN IF NOT EXISTS verified_at timestamp;
    -- Artists verified before this existed: the best date we have is when they joined.
    UPDATE stylist_profiles SET verified_at = created_at WHERE verified = true AND verified_at IS NULL;

    CREATE TABLE IF NOT EXISTS reputation_events (
      id text PRIMARY KEY,
      stylist_id text NOT NULL REFERENCES stylist_profiles(id) ON DELETE CASCADE,
      type text NOT NULL,
      source_type text NOT NULL,
      source_id text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'active',
      event_at timestamp NOT NULL,
      idempotency_key text NOT NULL,
      reversed_at timestamp,
      reversal_reason text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS reputation_events_key_unique ON reputation_events(idempotency_key);
    CREATE INDEX IF NOT EXISTS reputation_events_stylist_idx ON reputation_events(stylist_id, status);

    CREATE TABLE IF NOT EXISTS reputation_summary (
      stylist_id text PRIMARY KEY REFERENCES stylist_profiles(id) ON DELETE CASCADE,
      reliability real NOT NULL DEFAULT 0,
      satisfaction real NOT NULL DEFAULT 0,
      professionalism real NOT NULL DEFAULT 0,
      consistency real NOT NULL DEFAULT 0,
      community real NOT NULL DEFAULT 0,
      overall real NOT NULL DEFAULT 0,
      displayed_score integer NOT NULL DEFAULT 0,
      tier text NOT NULL DEFAULT 'new_talent',
      evidence_sufficient boolean NOT NULL DEFAULT false,
      completed_bookings integer NOT NULL DEFAULT 0,
      review_count integer NOT NULL DEFAULT 0,
      active_months integer NOT NULL DEFAULT 0,
      below_tier_months integer NOT NULL DEFAULT 0,
      last_review_month text,
      calc_version integer NOT NULL DEFAULT 1,
      calculated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reputation_tier_history (
      id text PRIMARY KEY,
      stylist_id text NOT NULL REFERENCES stylist_profiles(id) ON DELETE CASCADE,
      from_tier text,
      to_tier text NOT NULL,
      reason text NOT NULL,
      score real NOT NULL,
      calc_version integer NOT NULL DEFAULT 1,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reputation_disputes (
      id text PRIMARY KEY,
      event_id text NOT NULL REFERENCES reputation_events(id) ON DELETE CASCADE,
      stylist_id text NOT NULL REFERENCES stylist_profiles(id) ON DELETE CASCADE,
      reason text NOT NULL,
      status text NOT NULL DEFAULT 'open',
      decision_note text,
      decided_by text,
      decided_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reputation_audit_log (
      id text PRIMARY KEY,
      stylist_id text REFERENCES stylist_profiles(id) ON DELETE CASCADE,
      actor text NOT NULL,
      action text NOT NULL,
      reason text NOT NULL,
      event_id text,
      before jsonb,
      after jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS safety_checkins (
      id text PRIMARY KEY,
      appointment_id text NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      stylist_id text NOT NULL REFERENCES stylist_profiles(id) ON DELETE CASCADE,
      code text NOT NULL,
      photo_path text NOT NULL,
      status text NOT NULL,
      is_last_booking boolean NOT NULL DEFAULT false,
      note text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS safety_checkins_appointment_unique ON safety_checkins(appointment_id);
    CREATE UNIQUE INDEX IF NOT EXISTS safety_checkins_code_unique ON safety_checkins(code);
  `);
  await pool.query("COMMIT");
  console.log("Reputation tables ready.");
} catch (err) {
  await pool.query("ROLLBACK");
  throw err;
} finally {
  await pool.end();
}
