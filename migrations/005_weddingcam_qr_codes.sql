-- Gives each WeddingCam event a QR Tracker code. The code belongs to the host who
-- created the event and redirects to the event's join link, so hosts can show and
-- share the QR code again later and see how often it's scanned.
-- Run after 002_qr_tracker.sql and 004_qr_tracker_owners.sql, then deploy the API:
--   APP_ENV=production yarn run migrate 005_weddingcam_qr_codes.sql

BEGIN;

-- NULL for events created before this migration (rotating the QR code adds one),
-- and for events whose code was deleted in QR Tracker.
ALTER TABLE weddingcam_events
  ADD COLUMN IF NOT EXISTS qr_codeid TEXT REFERENCES qr_codes(codeid) ON DELETE SET NULL;

COMMIT;
