-- Adds the tables for WeddingCam. Run once before deploying:
--   APP_ENV=production yarn run migrate 003_weddingcam.sql

BEGIN;

-- One row per event. Only a hash of the QR secret is stored. Bumping
-- secret_version (rotating the QR code) signs out every guest.
-- photo_count and total_bytes are running totals used to enforce max_photos.
CREATE TABLE IF NOT EXISTS weddingcam_events (
  eventid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  secret_version INTEGER NOT NULL DEFAULT 1,
  uploads_open BOOLEAN NOT NULL DEFAULT TRUE,
  gallery_open BOOLEAN NOT NULL DEFAULT TRUE,
  -- Photos per guest; 0 means unlimited.
  shot_limit INTEGER NOT NULL DEFAULT 27,
  moderation TEXT NOT NULL DEFAULT 'none' CHECK (moderation IN ('none', 'approval')),
  -- The gallery stays "developing" until this time. NULL shows photos immediately.
  reveal_at TIMESTAMPTZ,
  max_photos INTEGER NOT NULL DEFAULT 5000,
  photo_count INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per guest session. Guests aren't ecosystem users: they join by
-- exchanging the QR secret for a random bearer token, and only its hash is stored.
CREATE TABLE IF NOT EXISTS weddingcam_guests (
  guestid TEXT PRIMARY KEY,
  eventid TEXT NOT NULL REFERENCES weddingcam_events(eventid) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  -- The event's secret_version when the guest joined.
  secret_version INTEGER NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  shot_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_expires_at TIMESTAMPTZ NOT NULL
);

-- One row per photo. The images live in S3 under originals/ and thumbs/,
-- named by photoid.
CREATE TABLE IF NOT EXISTS weddingcam_photos (
  photoid TEXT PRIMARY KEY,
  eventid TEXT NOT NULL REFERENCES weddingcam_events(eventid) ON DELETE CASCADE,
  guestid TEXT NOT NULL REFERENCES weddingcam_guests(guestid) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('visible', 'hidden', 'pending')),
  created_at TIMESTAMPTZ NOT NULL
);

-- The gallery is read newest first, a page at a time.
CREATE INDEX IF NOT EXISTS weddingcam_photos_eventid_created_at_idx
  ON weddingcam_photos (eventid, created_at DESC, photoid DESC);

-- One row per rate-limited request. Rows are only ever inserted (then cleaned
-- up after an hour), so concurrent requests never wait on each other's locks.
CREATE TABLE IF NOT EXISTS weddingcam_rate_hits (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weddingcam_rate_hits_scope_key_at_idx ON weddingcam_rate_hits (scope, key, at);

COMMIT;
