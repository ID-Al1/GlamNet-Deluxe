import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: databaseUrl });

// Additive only. Safe to run again.
try {
  await pool.query("BEGIN");
  await pool.query(`
    ALTER TABLE stylist_profiles
      ADD COLUMN IF NOT EXISTS founding_member boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS founding_member_since timestamp;
    ALTER TABLE artist_contacts
      ADD COLUMN IF NOT EXISTS last_touch_at timestamp,
      ADD COLUMN IF NOT EXISTS last_touch_note text;
  `);
  await pool.query("COMMIT");
  console.log("Founding member and keep-warm columns ready.");
} catch (err) {
  await pool.query("ROLLBACK");
  throw err;
} finally {
  await pool.end();
}
