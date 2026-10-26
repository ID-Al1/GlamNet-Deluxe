import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    ALTER TABLE stylist_profiles
      ADD COLUMN IF NOT EXISTS safety_contact_name text,
      ADD COLUMN IF NOT EXISTS safety_contact_phone text;
  `);
  await pool.query("COMMIT");
  console.log("Safety contact columns added to stylist_profiles.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
