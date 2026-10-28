import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymised_at timestamp");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_deletion_requests (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id),
      role text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      user_note text,
      owner_note text,
      requested_at timestamp NOT NULL DEFAULT now(),
      handled_at timestamp,
      handled_by text REFERENCES users(id),
      CONSTRAINT account_deletion_requests_status_check
        CHECK (status in ('pending','completed','rejected','withdrawn'))
    );
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS account_deletion_requests_user_idx ON account_deletion_requests (user_id)");
  // A person can only have one request open at a time.
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_one_pending ON account_deletion_requests (user_id) WHERE status = 'pending'");
  await pool.query("COMMIT");
  console.log("Account deletion table and users.anonymised_at are ready.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
