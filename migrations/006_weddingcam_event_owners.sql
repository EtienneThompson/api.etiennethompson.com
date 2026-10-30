-- Makes WeddingCam events belong to the host who created them, so each host only sees and
-- manages their own. Existing events go to the owner of their QR code, or else to the
-- "etienne" user. Run after 005_weddingcam_qr_codes.sql, then deploy the API:
--   APP_ENV=production yarn run migrate 006_weddingcam_event_owners.sql

BEGIN;

-- Copy the type of users.userid so the foreign key works whatever it's stored as.
DO $$
DECLARE
  userid_type TEXT;
BEGIN
  SELECT format_type(atttypid, atttypmod) INTO userid_type
  FROM pg_attribute
  WHERE attrelid = 'users'::regclass AND attname = 'userid';

  EXECUTE format('ALTER TABLE weddingcam_events ADD COLUMN IF NOT EXISTS userid %s REFERENCES users(userid) ON DELETE CASCADE', userid_type);
END $$;

-- The QR code was made by whoever created (or last rotated) the event.
UPDATE weddingcam_events e SET userid = q.userid
FROM qr_codes q
WHERE e.userid IS NULL AND q.codeid = e.qr_codeid;

UPDATE weddingcam_events SET userid = (SELECT userid FROM users WHERE username = 'etienne') WHERE userid IS NULL;

ALTER TABLE weddingcam_events ALTER COLUMN userid SET NOT NULL;

-- The dashboard reads one host's events, newest first.
CREATE INDEX IF NOT EXISTS weddingcam_events_userid_created_at_idx ON weddingcam_events (userid, created_at DESC);

COMMIT;
