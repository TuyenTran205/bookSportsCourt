ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_during_not_empty
  CHECK (NOT isempty(during));

ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_source_party
  CHECK (
    (source = 'online' AND customer_id IS NOT NULL)
    OR (
      source = 'manual'
      AND (customer_id IS NOT NULL OR guest_name IS NOT NULL)
    )
  );

ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_expires_for_hold
  CHECK (status = 'held' OR expires_at IS NULL);

CREATE OR REPLACE FUNCTION validate_venue_areas()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM areas district
    JOIN areas province ON province.id = NEW.province_id
    WHERE district.id = NEW.district_id
      AND province.type = 'province'
      AND district.type = 'district'
      AND district.parent_id = province.id
  ) THEN
    RAISE EXCEPTION 'VENUE_AREA_INVALID'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venues_validate_areas
BEFORE INSERT OR UPDATE OF province_id, district_id ON venues
FOR EACH ROW EXECUTE FUNCTION validate_venue_areas();

CREATE OR REPLACE FUNCTION validate_booking_time_range()
RETURNS TRIGGER AS $$
BEGIN
  IF lower(NEW.during) IS NULL
     OR upper(NEW.during) IS NULL
     OR lower(NEW.during) <> date_trunc('minute', lower(NEW.during))
     OR upper(NEW.during) <> date_trunc('minute', upper(NEW.during))
     OR EXTRACT(MINUTE FROM lower(NEW.during))::INT % 30 <> 0
     OR EXTRACT(MINUTE FROM upper(NEW.during))::INT % 30 <> 0
     OR upper(NEW.during) <= lower(NEW.during) THEN
    RAISE EXCEPTION 'INVALID_TIME_RANGE'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_validate_time_range
BEFORE INSERT OR UPDATE OF during ON bookings
FOR EACH ROW EXECUTE FUNCTION validate_booking_time_range();
