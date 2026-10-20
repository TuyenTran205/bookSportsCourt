CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE courts (
  id UUID PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sport_id UUID REFERENCES sports(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_courts_venue
  ON courts (venue_id) WHERE deleted_at IS NULL;

CREATE TABLE opening_hours (
  id UUID PRIMARY KEY,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  CHECK (open_time < close_time),
  UNIQUE (court_id, day_of_week)
);

CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_per_slot INT NOT NULL CHECK (price_per_slot >= 0),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  day_of_week SMALLINT[],
  date_override DATE,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);

CREATE INDEX idx_pricing_court ON pricing_rules (court_id);

CREATE TABLE blackout_periods (
  id UUID PRIMARY KEY,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  reason TEXT,
  during TSTZRANGE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_blackout_not_empty CHECK (NOT isempty(during))
);

CREATE INDEX idx_blackout_court
  ON blackout_periods USING gist (court_id, during);
