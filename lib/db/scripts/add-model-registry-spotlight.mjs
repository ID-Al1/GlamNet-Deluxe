import { Pool } from "pg";

// Adds the Bonisa registry number and the owner's Spotlight pick to model profiles.
// Existing verified models are numbered in the order they were verified.
// Safe to run repeatedly.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS model_registry_seq;
    ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS registry_number text;
    ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS spotlight_at timestamp;
    ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS spotlight_note text;
    CREATE UNIQUE INDEX IF NOT EXISTS model_profiles_registry_number_unique ON model_profiles (registry_number);
  `);
  const { rows } = await pool.query(
    `SELECT id FROM model_profiles WHERE verification_status = 'verified' AND registry_number IS NULL ORDER BY verified_at NULLS LAST, created_at`,
  );
  for (const r of rows) {
    await pool.query(
      `UPDATE model_profiles SET registry_number = 'BM-' || lpad(nextval('model_registry_seq')::text, 4, '0') WHERE id = $1 AND registry_number IS NULL`,
      [r.id],
    );
  }
  await pool.query("COMMIT");
  console.log(`Registry and spotlight migration complete. Numbered ${rows.length} existing verified model(s).`);
} catch (err) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
