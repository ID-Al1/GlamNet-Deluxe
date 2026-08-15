/**
 * Migration: add 'declined' to the appointment_status enum.
 *
 * Run this once against any database created before this value existed.
 * Fresh databases get it automatically from the Drizzle schema.
 *
 * Usage: node lib/db/scripts/add-appointment-status-declined.mjs
 */
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

console.log("Adding 'declined' to appointment_status enum...");
await pool.query(`
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'declined';
`);
console.log("Done.");

await pool.end();
