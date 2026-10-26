import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query("ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_category_check");
  await pool.query(`
    ALTER TABLE complaints ADD CONSTRAINT complaints_category_check CHECK (category in (
      'didnt_arrive','poor_service','payment_issue','refund_request','behaviour',
      'safety_concern','false_review','harassment','other','no_completion_code'
    ));
  `);
  await pool.query("COMMIT");
  console.log("Complaint category no_completion_code added.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
