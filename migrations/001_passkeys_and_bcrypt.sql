-- Adds passkey (WebAuthn) support and prepares the users table for bcrypt
-- password hashes. Run once against the login database before deploying:
--   psql "$DATABASE_URL" -f migrations/001_passkeys_and_bcrypt.sql

BEGIN;

-- bcrypt hashes are 60 characters, so make sure a fixed-length column
-- (e.g. CHAR(64) for the old SHA-256 hashes) doesn't pad or truncate them.
ALTER TABLE users ALTER COLUMN password TYPE TEXT;

-- The userid columns below copy the type of users.userid so the foreign keys
-- work whether it's stored as UUID, TEXT or VARCHAR.
DO $$
DECLARE
  userid_type TEXT;
BEGIN
  SELECT format_type(atttypid, atttypmod) INTO userid_type
  FROM pg_attribute
  WHERE attrelid = 'users'::regclass AND attname = 'userid';

  -- One row per registered passkey. A user can have several.
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS passkey_credentials (
      credentialid TEXT PRIMARY KEY,
      userid %s NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
      public_key TEXT NOT NULL,
      sign_count BIGINT NOT NULL DEFAULT 0,
      transports TEXT,
      created_at TIMESTAMP NOT NULL,
      last_used_at TIMESTAMP
    )', userid_type);

  -- Short-lived, single-use challenges for passkey registration and login.
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      challengeid TEXT PRIMARY KEY,
      challenge TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN (''registration'', ''authentication'')),
      userid %s REFERENCES users(userid) ON DELETE CASCADE,
      expiration TIMESTAMP NOT NULL
    )', userid_type);
END $$;

CREATE INDEX IF NOT EXISTS passkey_credentials_userid_idx ON passkey_credentials (userid);
CREATE INDEX IF NOT EXISTS webauthn_challenges_expiration_idx ON webauthn_challenges (expiration);

COMMIT;
