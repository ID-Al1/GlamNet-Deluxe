import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_contacts (
      id text PRIMARY KEY,
      name text NOT NULL DEFAULT '',
      email text,
      phone text,
      specialty text,
      location text,
      instagram text,
      notes text,
      sources text[] NOT NULL DEFAULT '{}',
      stylist_profile_id text REFERENCES stylist_profiles(id) ON DELETE SET NULL,
      waitlist_data jsonb,
      waitlist_joined_at timestamp,
      reminders_paused boolean NOT NULL DEFAULT false,
      reminder_stage text,
      stage_since timestamp,
      reminders_sent integer NOT NULL DEFAULT 0,
      last_reminded_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS artist_contacts_email_unique ON artist_contacts(email);
    CREATE UNIQUE INDEX IF NOT EXISTS artist_contacts_phone_unique ON artist_contacts(phone);
    CREATE UNIQUE INDEX IF NOT EXISTS artist_contacts_profile_unique ON artist_contacts(stylist_profile_id);
    CREATE TABLE IF NOT EXISTS artist_contact_messages (
      id text PRIMARY KEY,
      contact_id text NOT NULL REFERENCES artist_contacts(id) ON DELETE CASCADE,
      kind text NOT NULL,
      reason text NOT NULL,
      subject text NOT NULL,
      body text NOT NULL,
      channels text[] NOT NULL DEFAULT '{}',
      sent_by_user_id text REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS artist_contact_messages_contact_idx ON artist_contact_messages(contact_id, created_at);
    CREATE TABLE IF NOT EXISTS owner_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await pool.query("COMMIT");
  console.log("Artist contacts tables created.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
