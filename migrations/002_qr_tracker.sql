-- Adds the tables for QR Tracker (qr.etiennethompson.com). Run once before deploying:
--   APP_ENV=production yarn run migrate 002_qr_tracker.sql

BEGIN;

-- One row per QR code. codeid is the short random id encoded in the scan link.
-- visit_count and last_visit_at are running totals so the list page doesn't
-- have to count visits; qr_visits is the source of truth.
CREATE TABLE IF NOT EXISTS qr_codes (
  codeid TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  target_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  visit_count INTEGER NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ
);

-- One row per scan.
CREATE TABLE IF NOT EXISTS qr_visits (
  visitid BIGSERIAL PRIMARY KEY,
  codeid TEXT NOT NULL REFERENCES qr_codes(codeid) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT NOT NULL DEFAULT '',
  referer TEXT NOT NULL DEFAULT ''
);

-- Visits are always read for one code over a time range.
CREATE INDEX IF NOT EXISTS qr_visits_codeid_visited_at_idx ON qr_visits (codeid, visited_at);

COMMIT;
