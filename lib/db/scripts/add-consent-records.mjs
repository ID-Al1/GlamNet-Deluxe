import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consent_records (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id),
      document_type text NOT NULL,
      document_version text NOT NULL,
      decision text NOT NULL,
      action text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT consent_records_decision_check
        CHECK (decision IN ('accepted', 'acknowledged', 'declined', 'withdrawn'))
    );
    CREATE INDEX IF NOT EXISTS consent_records_user_idx
      ON consent_records (user_id, document_type, created_at);
  `);
  await pool.query("COMMIT");
  console.log("consent_records table ready.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
