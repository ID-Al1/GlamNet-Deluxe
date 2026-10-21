import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  // No backfill on purpose. We do not know when existing pending artists really
  // submitted, so the owner queue falls back to the profile creation date for them.
  await pool.query(`
    ALTER TABLE stylist_profiles
      ADD COLUMN IF NOT EXISTS verification_submitted_at timestamp,
      ADD COLUMN IF NOT EXISTS verification_rejection_reason text;
  `);
  await pool.query("COMMIT");
  console.log("Verification review fields added to stylist_profiles.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
