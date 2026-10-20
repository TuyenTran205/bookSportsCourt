CREATE TABLE areas (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('province', 'district')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id UUID REFERENCES areas(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (type = 'province' AND parent_id IS NULL)
    OR (type = 'district' AND parent_id IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (parent_id, slug)
);

CREATE INDEX idx_areas_parent ON areas (parent_id);

CREATE TABLE sports (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE amenities (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venues (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  address TEXT NOT NULL,
  province_id UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  district_id UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  cover_url TEXT,
  rating_avg NUMERIC(2, 1) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  from_price INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_venues_owner
  ON venues (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_status
  ON venues (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_area
  ON venues (province_id, district_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_rating
  ON venues (rating_avg DESC)
  WHERE status = 'approved' AND deleted_at IS NULL;
CREATE INDEX idx_venues_price
  ON venues (from_price)
  WHERE status = 'approved' AND deleted_at IS NULL;

CREATE TABLE venue_images (
  id UUID PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venue_sports (
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  PRIMARY KEY (venue_id, sport_id)
);

CREATE TABLE venue_amenities (
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
  PRIMARY KEY (venue_id, amenity_id)
);

CREATE TABLE venue_payment_accounts (
  venue_id UUID PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  bank_bin TEXT NOT NULL,
  account_no TEXT NOT NULL,
  account_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cancellation_policies (
  venue_id UUID PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  cancel_before_hours INT NOT NULL DEFAULT 24
    CHECK (cancel_before_hours >= 0),
  refund_percent INT NOT NULL DEFAULT 100
    CHECK (refund_percent BETWEEN 0 AND 100),
  deposit_percent INT NOT NULL DEFAULT 100
    CHECK (deposit_percent BETWEEN 10 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
