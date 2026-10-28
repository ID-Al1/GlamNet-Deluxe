import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  // New table only. Nothing that exists today is changed.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aftercare_pages (
      id text PRIMARY KEY,
      artist_profile_id text NOT NULL REFERENCES stylist_profiles(id) ON DELETE CASCADE,
      title text NOT NULL,
      category text NOT NULL,
      blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
      rebooking_url text,
      public_token text NOT NULL UNIQUE,
      published boolean NOT NULL DEFAULT false,
      reviewed_at timestamp,
      published_at timestamp,
      view_count integer NOT NULL DEFAULT 0,
      last_viewed_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT aftercare_pages_category_check
        CHECK (category in ('hair','braids','nails','lashes','makeup','other'))
    );
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS aftercare_pages_artist_idx ON aftercare_pages (artist_profile_id)");
  await pool.query("COMMIT");
  console.log("aftercare_pages table is ready.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
