-- Makes QR codes belong to a user, so each user only sees and manages their own.
-- Existing codes are given to the "etienne" user. Run once, then deploy the API:
--   APP_ENV=production yarn run migrate 004_qr_tracker_owners.sql

BEGIN;

-- Copy the type of users.userid so the foreign key works whatever it's stored as.
DO $$
DECLARE
  userid_type TEXT;
BEGIN
  SELECT format_type(atttypid, atttypmod) INTO userid_type
  FROM pg_attribute
  WHERE attrelid = 'users'::regclass AND attname = 'userid';

  EXECUTE format('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS userid %s REFERENCES users(userid) ON DELETE CASCADE', userid_type);
END $$;

UPDATE qr_codes SET userid = (SELECT userid FROM users WHERE username = 'etienne') WHERE userid IS NULL;

ALTER TABLE qr_codes ALTER COLUMN userid SET NOT NULL;

-- The list page reads one user's codes, newest first.
CREATE INDEX IF NOT EXISTS qr_codes_userid_created_at_idx ON qr_codes (userid, created_at DESC);

COMMIT;
