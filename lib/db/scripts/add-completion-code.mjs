import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS completion_code_nonce text,
      ADD COLUMN IF NOT EXISTS completion_code_requested_at timestamp,
      ADD COLUMN IF NOT EXISTS completion_code_requests integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS completion_code_attempts integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS completed_at timestamp,
      ADD COLUMN IF NOT EXISTS complaint_window_ends_at timestamp;
  `);
  await pool.query("COMMIT");
  console.log("Completion code columns added to appointments.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
