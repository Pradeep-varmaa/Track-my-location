-- ============================================================
-- Migration: Add GPS Tracking for Checked-In Visitors
-- Date: 2026-08-25
-- ============================================================
-- Adjust dialect keywords (e.g., BOOLEAN vs TINYINT, TEXT vs VARCHAR)
-- to match your existing schema conventions.

-- 1. Extend vma_request_visitors with tracking consent columns
-- ============================================================

ALTER TABLE vma_request_visitors
  ADD COLUMN IF NOT EXISTS location_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS location_consent_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS tracking_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_request_visitors_tracking
  ON vma_request_visitors (tracking_active)
  WHERE tracking_active = TRUE;

-- 2. Create vma_visitor_locations table
-- ============================================================

CREATE TABLE IF NOT EXISTS vma_visitor_locations (
  id              SERIAL PRIMARY KEY,
  rv_id           INTEGER NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION NOT NULL,
  recorded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_visitor_locations_rv
    FOREIGN KEY (rv_id)
    REFERENCES vma_request_visitors (rv_id)
    ON DELETE CASCADE
);

-- Composite index: latest location per visitor (used by GET /live)
CREATE INDEX IF NOT EXISTS idx_visitor_locations_rv_recorded
  ON vma_visitor_locations (rv_id, recorded_at DESC);

-- Index for querying recent pings (e.g., last 24h cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_visitor_locations_recorded
  ON vma_visitor_locations (recorded_at);

-- 3. Create vma_geofence_alerts table
-- ============================================================

-- If using MySQL, create the ENUM type as a CHECK constraint instead:
--   alert_type VARCHAR(50) NOT NULL
--   CHECK (alert_type IN ('ENTERED_RESTRICTED_ZONE','LEFT_PROPERTY','APPROACHED_BOUNDARY','GEOFENCE_BREACH'))
CREATE TYPE geofence_alert_type AS ENUM (
  'ENTERED_RESTRICTED_ZONE',
  'LEFT_PROPERTY',
  'APPROACHED_BOUNDARY',
  'GEOFENCE_BREACH'
);

CREATE TABLE IF NOT EXISTS vma_geofence_alerts (
  id           SERIAL PRIMARY KEY,
  rv_id        INTEGER NOT NULL,
  alert_type   geofence_alert_type NOT NULL,
  triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at  TIMESTAMP NULL,

  CONSTRAINT fk_geofence_alerts_rv
    FOREIGN KEY (rv_id)
    REFERENCES vma_request_visitors (rv_id)
    ON DELETE CASCADE
);

-- Index for active (unresolved) alerts per visitor
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_active
  ON vma_geofence_alerts (rv_id, triggered_at DESC)
  WHERE resolved_at IS NULL;

-- Index for admin dashboard: all alerts ordered by time
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_triggered
  ON vma_geofence_alerts (triggered_at DESC);
