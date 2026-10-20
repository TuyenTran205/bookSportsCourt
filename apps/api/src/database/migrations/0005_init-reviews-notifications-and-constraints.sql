CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  owner_reply TEXT,
  owner_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_venue
  ON reviews (venue_id) WHERE is_visible = true;

CREATE TABLE favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, venue_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user_unread
  ON notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs (actor_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at);

ALTER TABLE blackout_periods
  ADD CONSTRAINT excl_blackout_overlap
  EXCLUDE USING gist (court_id WITH =, during WITH &&);

ALTER TABLE bookings
  ADD CONSTRAINT excl_bookings_overlap
  EXCLUDE USING gist (
    court_id WITH =,
    during WITH &&
  )
  WHERE (status IN ('held', 'pending_payment', 'confirmed'));

CREATE OR REPLACE FUNCTION reject_booking_in_blackout()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM blackout_periods
    WHERE court_id = NEW.court_id
      AND during && NEW.during
  ) THEN
    RAISE EXCEPTION 'COURT_BLACKED_OUT'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_no_blackout
BEFORE INSERT OR UPDATE OF court_id, during, status ON bookings
FOR EACH ROW
WHEN (NEW.status IN ('held', 'pending_payment', 'confirmed'))
EXECUTE FUNCTION reject_booking_in_blackout();

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_venues_name_trgm
  ON venues USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION refresh_venue_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_id UUID := COALESCE(NEW.venue_id, OLD.venue_id);
BEGIN
  UPDATE venues
  SET
    rating_avg = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews
      WHERE venue_id = v_id AND is_visible = true
    ), 0),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE venue_id = v_id AND is_visible = true
    )
  WHERE id = v_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_refresh_venue
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_venue_rating();

CREATE OR REPLACE FUNCTION refresh_venue_from_price(p_venue UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE venues
  SET from_price = (
    SELECT MIN(pr.price_per_slot)
    FROM pricing_rules pr
    JOIN courts c ON c.id = pr.court_id
    WHERE c.venue_id = p_venue
      AND c.status = 'active'
      AND c.deleted_at IS NULL
  )
  WHERE id = p_venue;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_refresh_from_price_by_court()
RETURNS TRIGGER AS $$
DECLARE
  v_id UUID := COALESCE(NEW.venue_id, OLD.venue_id);
BEGIN
  PERFORM refresh_venue_from_price(v_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courts_refresh_price
AFTER INSERT OR UPDATE OF status, deleted_at OR DELETE ON courts
FOR EACH ROW EXECUTE FUNCTION trg_refresh_from_price_by_court();

CREATE OR REPLACE FUNCTION trg_refresh_from_price_by_rule()
RETURNS TRIGGER AS $$
DECLARE
  v_court_id UUID := COALESCE(NEW.court_id, OLD.court_id);
  v_venue_id UUID;
BEGIN
  SELECT venue_id INTO v_venue_id FROM courts WHERE id = v_court_id;
  PERFORM refresh_venue_from_price(v_venue_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pricing_rules_refresh_price
AFTER INSERT OR UPDATE OR DELETE ON pricing_rules
FOR EACH ROW EXECUTE FUNCTION trg_refresh_from_price_by_rule();
