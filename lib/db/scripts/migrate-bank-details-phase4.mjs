import { Pool } from "pg";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: url });
try {
  await pool.query("BEGIN");
  await pool.query(`CREATE TABLE IF NOT EXISTS bank_accounts (
    id text PRIMARY KEY, stylist_profile_id text NOT NULL REFERENCES stylist_profiles(id) ON DELETE CASCADE,
    bank_name text NOT NULL, account_holder_name text NOT NULL, account_number text NOT NULL,
    account_type text NOT NULL, verification_status text NOT NULL DEFAULT 'pending', revision integer NOT NULL DEFAULT 1,
    verified_at timestamptz, verified_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_stylist_profile_unique ON bank_accounts(stylist_profile_id);
    CREATE TABLE IF NOT EXISTS bank_account_access_log (
      id text PRIMARY KEY, bank_account_id text NOT NULL REFERENCES bank_accounts(id),
      viewed_by_user_id text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
    DO $$ BEGIN
      ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_account_type_check
        CHECK (account_type IN ('cheque', 'savings', 'other'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
    DO $$ BEGIN
      ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_verification_status_check
        CHECK (verification_status IN ('pending', 'verified', 'failed'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE bank_account_access_log DROP CONSTRAINT bank_account_access_log_bank_account_id_fkey;
      ALTER TABLE bank_account_access_log ADD CONSTRAINT bank_account_access_log_bank_account_id_fkey
        FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
    EXCEPTION WHEN undefined_object THEN
      ALTER TABLE bank_account_access_log ADD CONSTRAINT bank_account_access_log_bank_account_id_fkey
        FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
    END $$;
    CREATE INDEX IF NOT EXISTS bank_account_access_log_bank_account_idx ON bank_account_access_log(bank_account_id);
    CREATE INDEX IF NOT EXISTS bank_account_access_log_viewed_by_idx ON bank_account_access_log(viewed_by_user_id);`);
  await pool.query("COMMIT");
  console.log("Phase 4 bank-details migration complete.");
} catch (e) { await pool.query("ROLLBACK"); throw e; } finally { await pool.end(); }