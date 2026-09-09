-- Bonisa Phase 3; safe to run repeatedly in development.
CREATE SEQUENCE IF NOT EXISTS complaint_case_number_seq;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
CREATE TABLE IF NOT EXISTS complaints (
 id text PRIMARY KEY, case_number text NOT NULL UNIQUE, appointment_id text REFERENCES appointments(id),
 complainant_user_id text NOT NULL REFERENCES users(id), subject_user_id text REFERENCES users(id), complainant_role text NOT NULL,
 category text NOT NULL, description text NOT NULL, status text NOT NULL DEFAULT 'new',
 created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), resolved_at timestamp
);
CREATE TABLE IF NOT EXISTS complaint_evidence (
 id text PRIMARY KEY, complaint_id text NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
 uploaded_by_user_id text NOT NULL REFERENCES users(id), object_path text NOT NULL, url text NOT NULL,
 mime_type text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS complaint_evidence_path_unique ON complaint_evidence(complaint_id, object_path);
CREATE TABLE IF NOT EXISTS complaint_owner_notes (
 id text PRIMARY KEY, complaint_id text NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
 owner_id text NOT NULL REFERENCES users(id), note text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS complaint_activity (
 id text PRIMARY KEY, complaint_id text NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
 actor_user_id text REFERENCES users(id), action text NOT NULL, details text, created_at timestamp NOT NULL DEFAULT now()
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_account_status_check') THEN
   ALTER TABLE users ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active','suspended'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_role_check') THEN
   ALTER TABLE complaints ADD CONSTRAINT complaints_role_check CHECK (complainant_role IN ('client','stylist'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_category_check') THEN
   ALTER TABLE complaints ADD CONSTRAINT complaints_category_check CHECK (category IN ('didnt_arrive','poor_service','payment_issue','refund_request','behaviour','safety_concern','false_review','harassment','other'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_status_check') THEN
   ALTER TABLE complaints ADD CONSTRAINT complaints_status_check CHECK (status IN ('new','under_review','waiting_for_client','waiting_for_artist','resolved','escalated','closed'));
 END IF;
END $$;