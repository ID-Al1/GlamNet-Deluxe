import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

console.log("Adding unique index to prevent double-bookings...");
await pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS appointments_stylist_slot_active_unique
  ON appointments (stylist_id, date, time)
  WHERE status IN ('pending', 'confirmed');
`);
console.log("Done.");

await pool.end();
