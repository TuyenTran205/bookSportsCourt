-- ============================================================================
-- Migration: 0012_add-administrative-units-columns.sql
-- Mục đích: Chuyển đổi mô hình ĐVHC sang 2 cấp (34 tỉnh / 3.321 xã)
-- Ngày cập nhật: 2026-11-10
-- ============================================================================

-- 1. Bật extensions phục vụ tìm kiếm không dấu
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Thêm cột code và unaccent_name vào bảng areas
ALTER TABLE areas ADD COLUMN IF NOT EXISTS code VARCHAR(10);
ALTER TABLE areas ADD COLUMN IF NOT EXISTS unaccent_name TEXT;

-- 3. Cập nhật ràng buộc type cho areas (chấp nhận 'province', 'ward', 'district')
ALTER TABLE areas DROP CONSTRAINT IF EXISTS areas_type_check;
ALTER TABLE areas ADD CONSTRAINT areas_type_check CHECK (type IN ('province', 'ward', 'district'));

-- 4. Cập nhật ràng buộc hierarchy cho areas
ALTER TABLE areas DROP CONSTRAINT IF EXISTS areas_check;
ALTER TABLE areas ADD CONSTRAINT areas_check CHECK (
  (type = 'province' AND parent_id IS NULL)
  OR (type IN ('ward', 'district') AND parent_id IS NOT NULL)
);

-- 5. Bổ sung indexes tối ưu tìm kiếm cho areas
CREATE INDEX IF NOT EXISTS idx_areas_code ON areas(code);
CREATE INDEX IF NOT EXISTS idx_areas_type_parent ON areas(type, parent_id);
CREATE INDEX IF NOT EXISTS idx_areas_parent_type ON areas(parent_id, type);
CREATE INDEX IF NOT EXISTS idx_areas_unaccent_trgm ON areas USING gin (unaccent_name gin_trgm_ops);

-- 6. Cập nhật bảng venues: thêm ward_id, nới lỏng district_id thành NULL
ALTER TABLE venues ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES areas(id) ON DELETE RESTRICT;
ALTER TABLE venues ALTER COLUMN district_id DROP NOT NULL;

-- 7. Bổ sung index cho venues theo province_id và ward_id
CREATE INDEX IF NOT EXISTS idx_venues_province_ward ON venues(province_id, ward_id) WHERE deleted_at IS NULL;
