# HƯỚNG DẪN BACKEND: CẬP NHẬT ĐƠN VỊ HÀNH CHÍNH VIỆT NAM 2 CẤP (34 TỈNH / 3.321 XÃ-PHƯỜNG)

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-11-21  
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

### 2.1. Migration Drizzle thực tế trong dự án (`0012` & `0013`)

Trong codebase hiện tại, việc nâng cấp bảng `areas`, `venues` và trigger kiểm tra phân cấp ĐVHC 2 cấp đã được thực hiện qua 2 file migration:
- `apps/api/src/database/migrations/0012_add-administrative-units-columns.sql`
- `apps/api/src/database/migrations/0013_update_validate_venue_areas.sql`

Nội dung SQL cốt lõi:

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

### 2.2. Khai báo Schema Drizzle (`apps/api/src/database/schema/schema.ts`)

Trong codebase thực tế, toàn bộ bảng được khai báo tập trung tại `apps/api/src/database/schema/schema.ts` với khoá chính UUID v7 (`$defaultFn(() => v7())`):

```typescript
// apps/api/src/database/schema/schema.ts
export const areas = pgTable(
  'areas',
  {
    id: uuid('id').primaryKey().$defaultFn(() => v7()),
    code: varchar('code', { length: 10 }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    unaccentName: varchar('unaccent_name', { length: 150 }),
    type: varchar('type', { length: 20 }).notNull(), // 'province' | 'ward' | 'district'
    parentId: uuid('parent_id').references((): AnyPgColumn => areas.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uqAreasTypeCode: uniqueIndex('uq_areas_type_code').on(table.type, table.code),
    idxAreasParentType: index('idx_areas_parent_type').on(table.parentId, table.type),
  }),
);
```

---

## 3. SEEDING & PIPELINE DỮ LIỆU

### 3.1. Nguồn dữ liệu đã kiểm định trong `packages/shared`
- **Tỉnh/Thành phố (34 tỉnh):** `packages/shared/src/data/provinces.json` & `packages/shared/src/data/provinces.ts` (được phép import ở cả FE và BE).
- **Xã/Phường/Đặc khu (3.321 xã/phường):** `packages/shared/src/data/wards.json` (chỉ dùng ở BE, script seed và MSW handler).

### 3.2. Script Seed Idempotent (`apps/api/scripts/seed.ts`)

Quy trình nạp dữ liệu trong `apps/api/scripts/seed.ts`:
1. Đọc dữ liệu chuẩn hoá từ `packages/shared/src/data/provinces.json` và `packages/shared/src/data/wards.json`.
2. Chèn/cập nhật 34 Tỉnh/Thành phố trước (`type = 'province'`, `parent_id = null`), lưu map `provinceCode -> provinceId`.
3. Chèn/cập nhật 3.321 Xã/Phường/Đặc khu (`type = 'ward'`, `parent_id = provinceId`) cùng các quận/huyện legacy phục vụ dữ liệu mẫu.
4. Sử dụng `ON CONFLICT` để đảm bảo chạy lại nhiều lần an toàn (`idempotent`).

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

Các endpoints tra cứu ĐVHC đã được triển khai tại `LocationsController` và `CatalogsController` (`apps/api/src/modules/catalogs/`):

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

### 5.2. `GET /api/v1/provinces/:code/wards` & `GET /api/v1/provinces/:id/wards`
- **Mục đích:** Trả về danh sách xã/phường thuộc tỉnh tương ứng (tra cứu theo mã tỉnh GSO 2 chữ số tại `LocationsController` hoặc theo UUID tỉnh tại `CatalogsController`).
- **Query Params:**
  - `q`: Tìm kiếm gần đúng tên xã không phân biệt hoa/thường, không dấu (ví dụ: `?q=ben+nghe`).
  - `limit`: Số kết quả tối đa (mặc định 50 ở `/provinces/:code/wards`).

### 5.3. `GET /api/v1/wards/search`
- **Mục đích:** Autocomplete nhanh toàn quốc hoặc giới hạn theo tỉnh.
- **Query Params:** `q` (từ khoá bắt buộc), `provinceCode` (tùy chọn, mã tỉnh 2 chữ số), `limit` (mặc định 20, tối đa 50).

### 5.4. Cập nhật `GET /api/v1/venues` (Tìm kiếm & Lọc cơ sở)
- **Tham số nhận thêm:** `provinceCode`, `wardCode`, `provinceId`, `wardId` (cùng `districtId` legacy).
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
