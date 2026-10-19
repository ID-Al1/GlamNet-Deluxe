import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  // Existing accounts keep NULL: they signed up before consent was captured,
  // and we must not pretend they consented.
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS privacy_consent_at timestamp,
      ADD COLUMN IF NOT EXISTS privacy_policy_version text;
  `);
  await pool.query("COMMIT");
  console.log("Privacy consent columns added to users.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
