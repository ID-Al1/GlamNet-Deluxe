import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  const { rows: duplicates } = await pool.query(`
    SELECT translate(btrim(phone), ' -()', '') AS normalized_phone
    FROM users
    WHERE phone IS NOT NULL AND btrim(phone) <> ''
    GROUP BY translate(btrim(phone), ' -()', '')
    HAVING COUNT(*) > 1
  `);
  if (duplicates.length > 0) {
    throw new Error("Cannot add unique phone constraint: duplicate phone numbers exist");
  }

  await pool.query(`
    UPDATE users
    SET phone = NULLIF(translate(btrim(phone), ' -()', ''), '')
    WHERE phone IS NOT NULL;
  `);
  await pool.query(`
    ALTER TABLE users
      ADD CONSTRAINT users_phone_unique UNIQUE (phone);
  `).catch(async (error) => {
    if (error.code !== "42710") throw error;
  });
  await pool.query("COMMIT");
  console.log("Phone numbers normalized and uniqueness enforced.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}