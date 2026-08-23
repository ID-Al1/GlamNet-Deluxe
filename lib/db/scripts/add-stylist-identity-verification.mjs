import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    ALTER TABLE stylist_profiles
      ADD COLUMN IF NOT EXISTS id_number text,
      ADD COLUMN IF NOT EXISTS id_document_url text;
  `);
  await pool.query("COMMIT");
  console.log("Private artist identity-verification columns added.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}