import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM appointments a
        LEFT JOIN stylist_profiles sp ON sp.id = a.stylist_id
        WHERE sp.id IS NULL
      ) THEN
        RAISE EXCEPTION 'Cannot add appointments stylist foreign key: orphaned rows exist';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM casting_applications ca
        LEFT JOIN stylist_profiles sp ON sp.id = ca.stylist_id
        WHERE sp.id IS NULL
      ) THEN
        RAISE EXCEPTION 'Cannot add casting applications stylist foreign key: orphaned rows exist';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM conversations c
        LEFT JOIN users u ON u.id = c.stylist_id
        WHERE u.id IS NULL
      ) THEN
        RAISE EXCEPTION 'Cannot add conversations stylist foreign key: orphaned rows exist';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM booking_team_members btm
        LEFT JOIN stylist_profiles sp ON sp.id = btm.stylist_id
        WHERE sp.id IS NULL
      ) THEN
        RAISE EXCEPTION 'Cannot add booking team members stylist foreign key: orphaned rows exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'appointments_stylist_id_stylist_profiles_id_fk'
      ) THEN
        ALTER TABLE appointments
          ADD CONSTRAINT appointments_stylist_id_stylist_profiles_id_fk
          FOREIGN KEY (stylist_id) REFERENCES stylist_profiles(id) ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'casting_applications_stylist_id_stylist_profiles_id_fk'
      ) THEN
        ALTER TABLE casting_applications
          ADD CONSTRAINT casting_applications_stylist_id_stylist_profiles_id_fk
          FOREIGN KEY (stylist_id) REFERENCES stylist_profiles(id) ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'conversations_stylist_id_users_id_fk'
      ) THEN
        ALTER TABLE conversations
          ADD CONSTRAINT conversations_stylist_id_users_id_fk
          FOREIGN KEY (stylist_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'booking_team_members_stylist_id_stylist_profiles_id_fk'
      ) THEN
        ALTER TABLE booking_team_members
          ADD CONSTRAINT booking_team_members_stylist_id_stylist_profiles_id_fk
          FOREIGN KEY (stylist_id) REFERENCES stylist_profiles(id) ON DELETE CASCADE;
      END IF;
    END
    $$;
  `);
  await pool.query("COMMIT");
  console.log("Stylist foreign keys added.");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}