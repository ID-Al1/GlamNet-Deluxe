import { Pool } from "pg";

// Bonisa model portal: adds the "model" role and the tables behind the public
// model directory, opportunities, applications and the audit trail.
// Safe to run repeatedly.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  // ALTER TYPE ... ADD VALUE is kept outside the transaction below.
  await pool.query(`ALTER TYPE role ADD VALUE IF NOT EXISTS 'model'`);

  await pool.query("BEGIN");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS model_profiles (
      id text PRIMARY KEY,
      user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      professional_name text NOT NULL,
      category text NOT NULL DEFAULT '',
      area text NOT NULL DEFAULT '',
      bio text,
      skills text[] NOT NULL DEFAULT '{}',
      service_categories text[] NOT NULL DEFAULT '{}',
      availability text NOT NULL DEFAULT 'unavailable',
      accepts_enquiries boolean NOT NULL DEFAULT true,
      starting_rate_cents integer,
      rate_note text,
      creative_identity text,
      collaboration_preferences text,
      career_goals text,
      visibility jsonb NOT NULL DEFAULT '{}',
      is_published boolean NOT NULL DEFAULT false,
      published_at timestamp,
      verification_status text NOT NULL DEFAULT 'none',
      verification_requested_at timestamp,
      verified_at timestamp,
      verification_rejection_reason text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT model_profiles_verification_check CHECK (verification_status in ('none', 'pending', 'verified', 'rejected')),
      CONSTRAINT model_profiles_availability_check CHECK (availability in ('available', 'limited', 'unavailable'))
    );

    CREATE TABLE IF NOT EXISTS model_photos (
      id text PRIMARY KEY,
      model_profile_id text NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
      kind text NOT NULL,
      object_path text NOT NULL,
      mime_type text NOT NULL,
      is_public boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT model_photos_kind_check CHECK (kind in ('front', 'left', 'right', 'full_length', 'editorial'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS model_photos_one_digital_per_kind
      ON model_photos (model_profile_id, kind) WHERE kind <> 'editorial';

    CREATE TABLE IF NOT EXISTS model_social_links (
      id text PRIMARY KEY,
      model_profile_id text NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
      platform text NOT NULL,
      url text NOT NULL,
      handle text,
      follower_count integer,
      stat_source text NOT NULL DEFAULT 'self_reported',
      stat_updated_at timestamp,
      is_public boolean NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS model_enquiries (
      id text PRIMARY KEY,
      model_profile_id text NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
      from_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id text PRIMARY KEY,
      organiser_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organiser_name text NOT NULL,
      type text NOT NULL,
      title text NOT NULL,
      brief text NOT NULL,
      deliverables text NOT NULL,
      eligibility text,
      start_date date,
      end_date date,
      location text NOT NULL DEFAULT '',
      is_remote boolean NOT NULL DEFAULT false,
      compensation_cents integer,
      compensation_note text NOT NULL DEFAULT '',
      expenses_note text NOT NULL DEFAULT '',
      usage_rights text NOT NULL,
      exclusivity text NOT NULL DEFAULT 'None',
      payment_terms text NOT NULL,
      application_deadline date NOT NULL,
      status text NOT NULL DEFAULT 'open',
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT opportunities_status_check CHECK (status in ('open', 'closed'))
    );
    CREATE INDEX IF NOT EXISTS opportunities_status_idx ON opportunities (status);

    CREATE TABLE IF NOT EXISTS opportunity_applications (
      id text PRIMARY KEY,
      opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      model_profile_id text NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
      message text NOT NULL,
      proposed_fee_cents integer,
      status text NOT NULL DEFAULT 'applied',
      status_note text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT opportunity_applications_status_check CHECK (status in ('applied', 'shortlisted', 'accepted', 'passed', 'withdrawn'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS opportunity_applications_one_per_model
      ON opportunity_applications (opportunity_id, model_profile_id);

    CREATE TABLE IF NOT EXISTS saved_opportunities (
      model_profile_id text NOT NULL REFERENCES model_profiles(id) ON DELETE CASCADE,
      opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (model_profile_id, opportunity_id)
    );

    CREATE TABLE IF NOT EXISTS opportunity_reports (
      id text PRIMARY KEY,
      opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      reporter_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS opportunity_reports_one_per_reporter
      ON opportunity_reports (opportunity_id, reporter_user_id);

    CREATE TABLE IF NOT EXISTS audit_events (
      id text PRIMARY KEY,
      actor_user_id text,
      actor_role text NOT NULL,
      action text NOT NULL,
      target_type text NOT NULL,
      target_id text NOT NULL,
      details jsonb NOT NULL DEFAULT '{}',
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events (created_at);
  `);
  await pool.query("COMMIT");
  console.log("Model portal migration complete.");
} catch (err) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
