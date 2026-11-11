-- ============================================================================
-- Migration: 0013_update_validate_venue_areas.sql
-- Mục đích: Cập nhật hàm validate_venue_areas hỗ trợ mô hình 2 cấp (ward_id)
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_venue_areas()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Kiem tra tinh hop le
  IF NOT EXISTS (
    SELECT 1 FROM areas WHERE id = NEW.province_id AND type = 'province'
  ) THEN
    RAISE EXCEPTION 'VENUE_PROVINCE_INVALID' USING ERRCODE = '23514';
  END IF;

  -- 2. Phai co it nhat ward_id hoac district_id
  IF NEW.ward_id IS NULL AND NEW.district_id IS NULL THEN
    RAISE EXCEPTION 'VENUE_WARD_REQUIRED' USING ERRCODE = '23514';
  END IF;

  -- 3. Neu co ward_id, phai thuoc province_id da chon
  IF NEW.ward_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM areas
    WHERE id = NEW.ward_id
      AND type = 'ward'
      AND parent_id = NEW.province_id
  ) THEN
    RAISE EXCEPTION 'VENUE_WARD_INVALID' USING ERRCODE = '23514';
  END IF;

  -- 4. Neu co district_id (legacy), phai thuoc province_id da chon
  IF NEW.district_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM areas
    WHERE id = NEW.district_id
      AND type = 'district'
      AND parent_id = NEW.province_id
  ) THEN
    RAISE EXCEPTION 'VENUE_DISTRICT_INVALID' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venues_validate_areas ON venues;

CREATE TRIGGER trg_venues_validate_areas
BEFORE INSERT OR UPDATE OF province_id, district_id, ward_id ON venues
FOR EACH ROW EXECUTE FUNCTION validate_venue_areas();
