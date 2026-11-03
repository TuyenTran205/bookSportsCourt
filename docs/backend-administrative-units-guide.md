# HƯỚNG DẪN BACKEND: CẬP NHẬT ĐƠN VỊ HÀNH CHÍNH VIỆT NAM 2 CẤP (34 TỈNH / 3.321 XÃ-PHƯỜNG)

> **Dành cho:** Backend Engineer (`apps/api` - NestJS / PostgreSQL / Drizzle ORM)  
> **Phiên bản dữ liệu mốc:** 03/11/2026  
> **Tài liệu đối chiếu:** `AGENTS.md`, `docs/04-database-schema.md`, `docs/10-backend-conventions.md`, `docs/11-api-contract.md`, `docs/18-decision-log.md`

---

## 1. BỐI CẢNH & YÊU CẦU NGHIỆP VỤ

1. **Mô hình hành chính mới:** Theo quy định có hiệu lực từ 01/07/2025, Việt Nam áp dụng mô hình chính quyền địa phương 2 cấp:
   - **Cấp tỉnh:** 34 Tỉnh / Thành phố trực thuộc Trung ương.
   - **Cấp xã:** 3.321 Đơn vị hành chính cấp xã (gồm Xã, Phường, Thị trấn / Đặc khu).
   - **Cấp huyện / quận:** Đã bãi bỏ, không còn nằm trong luồng chọn địa lý chính thức.
2. **Vai trò của cấp quận/huyện cũ (`district`):**
   - Chỉ giữ vai trò **Legacy** để đảm bảo tương thích dữ liệu cũ và các bản ghi venue đã tồn tại.
   - Không được bắt buộc (`NOT NULL`) trong luồng tạo/lọc mới.
3. **Quy tắc vàng (AGENTS.md):**
   - *Không tin client:* Backend phải trực tiếp validate tính hợp lệ của `wardId` và quan hệ cha-con với `provinceId`.
   - *Kiểu dữ liệu chung ở `packages/shared`:* Dùng chung Types/Zod schemas, không duplicate mã nguồn.

---

## 2. DATABASE SCHEMA & MIGRATIONS

### 2.1. Migration Drizzle mới (Không sửa file migration cũ)

Tạo file migration có version tiếp theo (ví dụ: `0004_admin_units_two_tiers.sql`):

```sql
-- 1. Bật extensions phục vụ tìm kiếm không dấu
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Cập nhật ràng buộc type cho bảng areas
ALTER TABLE areas DROP CONSTRAINT IF EXISTS areas_type_check;
ALTER TABLE areas ADD CONSTRAINT areas_type_check CHECK (type IN ('province', 'ward', 'district'));

-- 3. Bổ sung cột mã định danh hành chính chính thức (chuỗi có số 0 ở đầu: '01', '00004')
ALTER TABLE areas ADD COLUMN IF NOT EXISTS code VARCHAR(10);
CREATE UNIQUE INDEX IF NOT EXISTS uq_areas_type_code ON areas(type, code);

-- 4. Ràng buộc phân cấp cha - con
-- Tỉnh bắt buộc parent_id IS NULL; Xã bắt buộc parent_id NOT NULL (trỏ về province)
ALTER TABLE areas DROP CONSTRAINT IF EXISTS chk_areas_parent_hierarchy;
ALTER TABLE areas ADD CONSTRAINT chk_areas_parent_hierarchy CHECK (
  (type = 'province' AND parent_id IS NULL) OR
  (type = 'ward' AND parent_id IS NOT NULL) OR
  (type = 'district') -- Cho phép dữ liệu legacy
);

-- 5. Chỉ mục tối ưu hóa tìm kiếm phân cấp & autocomplete tiếng Việt
CREATE INDEX IF NOT EXISTS idx_areas_parent_type ON areas(parent_id, type);
CREATE INDEX IF NOT EXISTS idx_areas_unaccent_name ON areas USING gin (unaccent(lower(name)) gin_trgm_ops);

-- 6. Cập nhật bảng venues: thêm ward_id, nới lỏng district_id
ALTER TABLE venues ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES areas(id) ON DELETE RESTRICT;
ALTER TABLE venues ALTER COLUMN district_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venues_province_ward ON venues(province_id, ward_id);
```

### 2.2. Khai báo Schema Drizzle (`apps/api/src/database/schema/areas.ts` & `venues.ts`)

```typescript
// apps/api/src/database/schema/areas.ts
import { pgTable, uuid, varchar, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const areas = pgTable('areas', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 10 }),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'province' | 'ward' | 'district'
  parentId: uuid('parent_id').references((): any => areas.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  typeCodeUq: uniqueIndex('uq_areas_type_code').on(table.type, table.code),
  parentTypeIdx: index('idx_areas_parent_type').on(table.parentId, table.type),
}));
```

---

## 3. SEEDING & PIPELINE DỮ LIỆU

### 3.1. Nguồn dữ liệu đã kiểm định
- **Nguồn chính:** `thanglequoc/vietnamese-provinces-database` (MIT License). Sử dụng tệp JSON tối giản: `json/simplified_json_generated_data_vn_units_minified.json`.
- **Nguồn đối chiếu & map cũ -> mới:** `HuyChuong/vietnam-administrative-units` (CC BY 4.0). Sử dụng `data/xa-cu-moi.json`.

### 3.2. Script Seed Idempotent (`apps/api/src/database/seeds/admin-units.seed.ts`)

Quy trình nạp dữ liệu:
1. Đọc tệp dataset chuẩn hoá từ `packages/shared/src/data/admin-units.generated.json`.
2. Chèn 34 Tỉnh/Thành phố trước (`type = 'province'`, `parentId = null`).
3. Chèn 3.321 Xã/Phường/Đặc khu (`type = 'ward'`, `parentId = province.id`).
4. Sử dụng câu lệnh `ON CONFLICT (type, code) DO UPDATE` để có thể chạy lại an toàn:

```typescript
// Minh họa truy vấn nạp tỉnh
await db.insert(areas)
  .values(provincesList)
  .onConflictDoUpdate({
    target: [areas.type, areas.code],
    set: { name: sql`EXCLUDED.name`, slug: sql`EXCLUDED.slug` },
  });
```

### 3.3. Script Backfill Dữ liệu Venues cũ (`scripts/backfill-venue-wards.ts`)
- Quét các venue đang có `ward_id IS NULL` nhưng có `district_id`.
- Sử dụng bảng mapping `xa-cu-moi.json` đối chiếu dựa trên `(province_id, district_id, address)`.
- Gán `ward_id` mới. Trường hợp không khớp tự động: ghi log chi tiết để quản trị viên đối soát thủ công.

---

## 4. VALIDATION & BUSINESS LOGIC (`packages/shared` & `apps/api`)

### 4.1. Cập nhật Shared Zod Schemas (`packages/shared/src/schemas.ts`)

```typescript
export const provinceCodeSchema = z.string().regex(/^\d{2}$/, 'Mã tỉnh không hợp lệ (2 chữ số)');
export const wardCodeSchema = z.string().regex(/^\d{5}$/, 'Mã xã/phường không hợp lệ (5 chữ số)');

// DTO tạo mới Venue
export const createVenueSchema = z.object({
  name: z.string().min(3).max(100),
  address: z.string().min(5),
  provinceId: z.string().uuid('ID tỉnh không hợp lệ'),
  wardId: z.string().uuid('ID xã/phường không hợp lệ'),
  districtId: z.string().uuid().optional().nullable(), // Legacy only
  // ... các trường khác
});
```

### 4.2. Business Integrity Guard (`apps/api/src/modules/venues/venues.service.ts`)

**Quy tắc:** Xã/Phường bắt buộc phải thuộc Tỉnh/Thành phố đã chọn.

```typescript
async validateLocationHierarchy(provinceId: string, wardId: string): Promise<void> {
  const ward = await this.areasRepository.findById(wardId);
  if (!ward || ward.type !== 'ward') {
    throw new UnprocessableEntityException({
      code: 'INVALID_WARD',
      message: 'Đơn vị xã/phường không tồn tại trên hệ thống.',
    });
  }

  if (ward.parentId !== provinceId) {
    throw new UnprocessableEntityException({
      code: 'HIERARCHY_MISMATCH',
      message: 'Xã/phường đã chọn không thuộc Tỉnh/Thành phố tương ứng.',
    });
  }
}
```

---

## 5. API CONTRACTS & CONTROLLERS

Bổ sung và cập nhật các endpoints trong `CatalogModule` / `VenuesModule`:

### 5.1. `GET /api/v1/provinces`
- **Mục đích:** Trả về danh sách 34 Tỉnh/Thành phố trực thuộc TW.
- **Cache Header:** `Cache-Control: public, max-age=86400, s-maxage=604800` (dữ liệu cực kỳ tĩnh).
- **Envelope Response:**
  ```json
  {
    "data": [
      {
        "id": "019273c5-7f00-7000-0000-000000000001",
        "code": "79",
        "name": "Thành phố Hồ Chí Minh",
        "slug": "ho-chi-minh",
        "type": "province"
      }
    ],
    "meta": {
      "version": "2026-11-03",
      "total": 34
    }
  }
  ```

### 5.2. `GET /api/v1/provinces/:codeOrId/wards`
- **Mục đích:** Trả về danh sách xã/phường thuộc tỉnh tương ứng.
- **Query Params:**
  - `q`: Tìm kiếm gần đúng tên xã không phân biệt hoa/thường, không dấu (ví dụ: `?q=ben+nghe`).
  - `page`, `limit` (mặc định limit = 50).
- **Truy vấn SQL mẫu:**
  ```sql
  SELECT id, code, name, slug, type, parent_id
  FROM areas
  WHERE parent_id = :provinceId
    AND type = 'ward'
    AND (:q IS NULL OR unaccent(lower(name)) LIKE '%' || unaccent(lower(:q)) || '%')
  ORDER BY name ASC
  LIMIT :limit OFFSET :offset;
  ```

### 5.3. `GET /api/v1/wards/search`
- **Mục đích:** Autocomplete nhanh toàn quốc hoặc giới hạn theo tỉnh.
- **Query Params:** `q` (từ khoá), `provinceId` (tùy chọn), `limit` (tối đa 20).

### 5.4. Cập nhật `GET /api/v1/venues` (Tìm kiếm & Lọc cơ sở)
- **Tham số nhận thêm:** `wardId` (hoặc `wardIds[]`).
- **Logic lọc:**
  - Nếu có `wardId`: `WHERE venues.ward_id = :wardId`.
  - Nếu chỉ có `provinceId`: `WHERE venues.province_id = :provinceId`.
  - Không bắt buộc `districtId`.

---

## 6. CHECKLIST NGHIỆM THU CHO BACKEND

- [ ] **Migration DB:** Chạy thành công trên PostgreSQL local/Docker mà không lỗi constraint cũ.
- [ ] **Seeding:** Nạp đủ **34 Tỉnh** và **3.321 Xã/Phường**. Chạy lại lệnh seed lần 2 không phát sinh lỗi trùng key (`idempotent`).
- [ ] **Search không dấu:** Gọi `GET /api/v1/provinces/:id/wards?q=ha+noi` hoặc `?q=ba+dinh` trả về kết quả chính xác không phụ thuộc dấu tiếng Việt.
- [ ] **Validation 422:** Thử gọi `POST /api/v1/venues` với `wardId` của Hà Nội nhưng `provinceId` của TP.HCM $\rightarrow$ API từ chối với mã `422 HIERARCHY_MISMATCH`.
- [ ] **Tương thích ngược:** Endpoint cũ `GET /api/v1/provinces/:id/districts` không bị lỗi thời (trả về danh sách rỗng hoặc map tương ứng nếu có).
- [ ] **Performance:** API `GET /api/v1/provinces` có Cache-Control; API danh sách xã có thời gian phản hồi $p95 \le 100\text{ms}$.
- [ ] **Test:** Đầy đủ Unit Test cho `validateLocationHierarchy` và Service lọc venue theo `wardId`.
