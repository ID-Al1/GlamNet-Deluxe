import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_updates (
      id text PRIMARY KEY,
      subject text NOT NULL,
      body text NOT NULL,
      audience_summary text NOT NULL,
      send_externally boolean NOT NULL DEFAULT true,
      recipient_count integer NOT NULL DEFAULT 0,
      sent_by_user_id text NOT NULL REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS artist_update_recipients (
      id text PRIMARY KEY,
      update_id text NOT NULL REFERENCES artist_updates(id) ON DELETE CASCADE,
      stylist_profile_id text NOT NULL REFERENCES stylist_profiles(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject text NOT NULL,
      body text NOT NULL,
      read_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS artist_update_recipients_user_idx ON artist_update_recipients(user_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS artist_update_recipients_update_profile_unique ON artist_update_recipients(update_id, stylist_profile_id);
  `);
  await pool.query("COMMIT");
  console.log("Artist updates tables created.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
