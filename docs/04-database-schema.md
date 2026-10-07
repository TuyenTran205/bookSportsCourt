# 04 – Database Schema

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-07

## Quy ước chung

- **snake_case** cho tất cả tên bảng và cột.
- **Soft delete:** thêm cột `deleted_at TIMESTAMPTZ DEFAULT NULL`; query luôn filter `deleted_at IS NULL`.
- **Timestamps:** mọi bảng có `created_at TIMESTAMPTZ DEFAULT now()` và `updated_at TIMESTAMPTZ DEFAULT now()`.
- **UUID v7** làm primary key (sắp xếp theo thời gian, phù hợp index B-tree).
- **Múi giờ:** Lưu UTC (timestamptz/tstzrange), hiển thị Asia/Ho_Chi_Minh ở FE/API response.
- **Migration:** Mọi thay đổi schema qua file migration có version (`0001_init.sql`, `0002_...sql`). KHÔNG sửa tay.

## ERD theo 3 cấp độ

Sơ đồ được vẽ theo 3 mức trừu tượng, từ nghiệp vụ đến cài đặt. Cả ba mô tả **cùng một schema**, chỉ khác mức chi tiết:

| Cấp độ | Mục đích | Có gì | Không có gì |
|--------|----------|-------|-------------|
| **1. Conceptual** (khái niệm) | Trao đổi nghiệp vụ, báo cáo | Thực thể, thuộc tính chính, quan hệ (hình thoi), bản số; quan hệ N-N giữ nguyên | Khóa ngoại, bảng trung gian, kiểu dữ liệu |
| **2. Logical** (logic) | Thiết kế dữ liệu | Mọi thuộc tính nghiệp vụ, PK/FK/UK, bảng trung gian cho quan hệ N-N | Kiểu dữ liệu riêng của PostgreSQL, index |
| **3. Physical** (vật lý) | Cài đặt migration | Mọi cột, kiểu PostgreSQL, PK/FK/UK, ràng buộc chính | (SQL đầy đủ nằm ở mục "Chi tiết bảng") |

Ký hiệu bản số: `1` = đúng một, `0..1` = không hoặc một, `N` = nhiều.

### 1. Conceptual ERD (Mô hình khái niệm)

Chỉ giữ thực thể nghiệp vụ. Bỏ `refresh_tokens` (chi tiết kỹ thuật của đăng nhập). Quan hệ N-N (**Cơ sở – Môn thể thao**, **Cơ sở – Tiện ích**, **Người dùng – Cơ sở yêu thích**) được vẽ thành hình thoi và chưa tách bảng. Chia 2 sơ đồ cho dễ đọc; **Người dùng** và **Cơ sở** xuất hiện ở cả hai.

**1a. Danh mục: cơ sở, sân, giá, giờ mở cửa**

```mermaid
flowchart LR
    classDef entity fill:#eef6ff,stroke:#1d4ed8,stroke-width:1.5px,color:#0f172a;
    classDef rel fill:#fff7ed,stroke:#c2410c,stroke-width:1.5px,color:#0f172a;

    USER["<b>NGƯỜI DÙNG</b><br/><u>id</u> · email · họ tên<br/>SĐT · vai trò · trạng thái"]:::entity
    VENUE["<b>CƠ SỞ</b><br/><u>id</u> · tên · slug · địa chỉ<br/>quận/huyện · tỉnh · trạng thái"]:::entity
    COURT["<b>SÂN</b><br/><u>id</u> · tên · mô tả<br/>trạng thái"]:::entity
    SPORT["<b>MÔN THỂ THAO</b><br/><u>id</u> · tên · slug"]:::entity
    AMEN["<b>TIỆN ÍCH</b><br/><u>id</u> · tên · slug"]:::entity
    IMG["<b>ẢNH CƠ SỞ</b><br/><u>id</u> · url"]:::entity
    OH["<b>GIỜ MỞ CỬA</b><br/><u>id</u> · thứ · giờ mở · giờ đóng"]:::entity
    PR["<b>QUY TẮC GIÁ</b><br/><u>id</u> · tên · giá/slot<br/>khung giờ · ưu tiên"]:::entity
    BO["<b>THỜI GIAN KHÓA SÂN</b><br/><u>id</u> · lý do · khoảng thời gian"]:::entity
    OAUTH["<b>TÀI KHOẢN LIÊN KẾT</b><br/><u>id</u> · nhà cung cấp · mã nhà cung cấp"]:::entity

    R_OWN{"sở hữu"}:::rel
    R_CON{"gồm"}:::rel
    R_IMG{"có ảnh"}:::rel
    R_OFF{"cung cấp"}:::rel
    R_PRO{"có"}:::rel
    R_FOR{"dành cho"}:::rel
    R_OH{"mở cửa theo"}:::rel
    R_PR{"áp dụng giá"}:::rel
    R_BO{"bị khóa bởi"}:::rel
    R_LNK{"đăng nhập qua"}:::rel

    USER ---|1| R_OWN ---|N| VENUE
    VENUE ---|1| R_CON ---|N| COURT
    VENUE ---|1| R_IMG ---|N| IMG
    VENUE ---|N| R_OFF ---|N| SPORT
    VENUE ---|N| R_PRO ---|N| AMEN
    COURT ---|N| R_FOR ---|"0..1"| SPORT
    COURT ---|1| R_OH ---|N| OH
    COURT ---|1| R_PR ---|N| PR
    COURT ---|1| R_BO ---|N| BO
    USER ---|1| R_LNK ---|N| OAUTH
```

**1b. Giao dịch: đặt sân, thanh toán, đánh giá, thông báo**

```mermaid
flowchart LR
    classDef entity fill:#eef6ff,stroke:#1d4ed8,stroke-width:1.5px,color:#0f172a;
    classDef rel fill:#fff7ed,stroke:#c2410c,stroke-width:1.5px,color:#0f172a;

    USER["<b>NGƯỜI DÙNG</b><br/><u>id</u> · email · họ tên · vai trò"]:::entity
    VENUE["<b>CƠ SỞ</b><br/><u>id</u> · tên · slug"]:::entity
    COURT["<b>SÂN</b><br/><u>id</u> · tên"]:::entity
    BOOK["<b>ĐẶT SÂN</b><br/><u>id</u> · khoảng thời gian · trạng thái<br/>tổng tiền · hết hạn giữ chỗ · lý do hủy"]:::entity
    PAY["<b>THANH TOÁN</b><br/><u>id</u> · số tiền · nhà cung cấp<br/>trạng thái · thời điểm trả"]:::entity
    REV["<b>ĐÁNH GIÁ</b><br/><u>id</u> · điểm 1-5 · nội dung<br/>hiển thị"]:::entity
    NOTI["<b>THÔNG BÁO</b><br/><u>id</u> · loại · tiêu đề<br/>nội dung · thời điểm đọc"]:::entity
    AUDIT["<b>NHẬT KÝ HỆ THỐNG</b><br/><u>id</u> · hành động · loại đối tượng<br/>dữ liệu cũ/mới · IP"]:::entity

    R_MAKE{"đặt"}:::rel
    R_HOST{"được đặt"}:::rel
    R_CAN{"hủy"}:::rel
    R_PAY{"được thanh toán bằng"}:::rel
    R_ABOUT{"được đánh giá bằng"}:::rel
    R_WRITE{"viết"}:::rel
    R_RECV{"nhận đánh giá"}:::rel
    R_FAV{"yêu thích"}:::rel
    R_NOTI{"nhận"}:::rel
    R_ACT{"thực hiện"}:::rel

    USER ---|1| R_MAKE ---|N| BOOK
    COURT ---|1| R_HOST ---|N| BOOK
    USER ---|"0..1"| R_CAN ---|N| BOOK
    BOOK ---|1| R_PAY ---|N| PAY
    BOOK ---|1| R_ABOUT ---|"0..1"| REV
    USER ---|1| R_WRITE ---|N| REV
    VENUE ---|1| R_RECV ---|N| REV
    USER ---|N| R_FAV ---|N| VENUE
    USER ---|1| R_NOTI ---|N| NOTI
    USER ---|"0..1"| R_ACT ---|N| AUDIT
```

### 2. Logical ERD (Mô hình logic)

Các bước chuyển từ conceptual sang logical:

- Quan hệ N-N được tách thành bảng trung gian: `venue_sports`, `venue_amenities`, `favorites`.
- Quan hệ 1-N được biểu diễn bằng khóa ngoại (FK) ở phía "N".
- Thêm `refresh_tokens` (phần kỹ thuật của xác thực).
- Mọi thuộc tính nghiệp vụ đều có mặt. **Không vẽ** các cột chung `created_at`, `updated_at`, `deleted_at` và `sort_order` để sơ đồ gọn (xem bảng ở mục Physical).

```mermaid
erDiagram
    users {
        id id PK
        string email UK
        string password_hash "NULL nếu chỉ đăng nhập OAuth"
        string full_name
        string phone
        string avatar_url
        string role "customer, owner, admin"
        string status "active, suspended, pending"
    }
    oauth_accounts {
        id id PK
        id user_id FK
        string provider "google"
        string provider_id "UK cùng provider"
    }
    refresh_tokens {
        id id PK
        id user_id FK
        string token_hash UK
        datetime expires_at
        boolean revoked
    }
    venues {
        id id PK
        id owner_id FK
        string name
        string slug UK
        text description
        string address
        string district
        string province
        decimal lat
        decimal lng
        string status "pending, approved, rejected, suspended"
        string cover_url
    }
    venue_images {
        id id PK
        id venue_id FK
        string url
    }
    sports {
        id id PK
        string name UK
        string slug UK
        string icon
    }
    amenities {
        id id PK
        string name UK
        string slug UK
        string icon
    }
    venue_sports {
        id venue_id PK, FK
        id sport_id PK, FK
    }
    venue_amenities {
        id venue_id PK, FK
        id amenity_id PK, FK
    }
    courts {
        id id PK
        id venue_id FK
        id sport_id FK "nullable"
        string name
        text description
        string status "active, inactive"
    }
    opening_hours {
        id id PK
        id court_id FK
        int day_of_week "0=CN ... 6=T7, UK cùng court_id"
        time open_time
        time close_time
    }
    pricing_rules {
        id id PK
        id court_id FK
        string name
        int price_per_slot "VND mỗi 30 phút"
        time start_time
        time end_time
        int_list day_of_week "NULL = mọi ngày"
        date date_override "ngày lễ"
        int priority
    }
    blackout_periods {
        id id PK
        id court_id FK
        string reason
        datetime_range during
    }
    bookings {
        id id PK
        id court_id FK
        id customer_id FK
        id cancelled_by FK "nullable"
        datetime_range during
        string status "held, pending_payment, confirmed, completed, cancelled, expired, no_show"
        int total_price "VND, tính ở server"
        string note
        string cancel_reason
        datetime expires_at "chỉ dùng khi held"
    }
    payments {
        id id PK
        id booking_id FK
        int amount
        string provider
        string provider_ref
        string status "pending, completed, failed, refunded"
        string idempotency_key UK
        datetime paid_at
    }
    reviews {
        id id PK
        id booking_id FK, UK
        id venue_id FK "suy ra từ booking, lưu thừa để truy vấn nhanh"
        id customer_id FK
        int rating "1..5"
        text content
        boolean is_visible
    }
    favorites {
        id user_id PK, FK
        id venue_id PK, FK
    }
    notifications {
        id id PK
        id user_id FK
        string type
        string title
        string body
        json data
        datetime read_at
    }
    audit_logs {
        id id PK
        id actor_id FK "nullable"
        string action
        string entity_type
        id entity_id
        json old_data
        json new_data
        string ip_address
    }

    users ||--o{ oauth_accounts : "liên kết"
    users ||--o{ refresh_tokens : "có"
    users ||--o{ venues : "sở hữu"
    users ||--o{ bookings : "đặt"
    users |o--o{ bookings : "hủy"
    users ||--o{ reviews : "viết"
    users ||--o{ favorites : "yêu thích"
    users ||--o{ notifications : "nhận"
    users |o--o{ audit_logs : "thực hiện"

    venues ||--o{ venue_images : "có ảnh"
    venues ||--o{ courts : "gồm"
    venues ||--o{ venue_sports : "cung cấp"
    venues ||--o{ venue_amenities : "có"
    venues ||--o{ reviews : "nhận"
    venues ||--o{ favorites : "được yêu thích"

    sports ||--o{ venue_sports : "thuộc"
    sports |o--o{ courts : "dành cho"
    amenities ||--o{ venue_amenities : "thuộc"

    courts ||--o{ opening_hours : "mở cửa"
    courts ||--o{ pricing_rules : "áp dụng giá"
    courts ||--o{ blackout_periods : "bị khóa"
    courts ||--o{ bookings : "được đặt"

    bookings ||--o{ payments : "thanh toán"
    bookings ||--o| reviews : "được đánh giá"
```

### 3. Physical ERD (Mô hình vật lý)

Kiểu dữ liệu và ràng buộc là của PostgreSQL 16. Một số kiểu viết gọn vì Mermaid không cho dấu phẩy trong kiểu: `NUMERIC_10_7` là `NUMERIC(10,7)`. Cột `PK` kiểu `UUID` có `DEFAULT gen_random_uuid()`.

```mermaid
erDiagram
    users {
        UUID id PK
        TEXT email UK "NOT NULL"
        TEXT password_hash "NULL nếu OAuth only"
        TEXT full_name "NOT NULL"
        TEXT phone
        TEXT avatar_url
        TEXT role "CHECK customer, owner, admin"
        TEXT status "DEFAULT active, CHECK active, suspended, pending"
        TIMESTAMPTZ created_at "DEFAULT now()"
        TIMESTAMPTZ updated_at "DEFAULT now()"
        TIMESTAMPTZ deleted_at "soft delete"
    }
    oauth_accounts {
        UUID id PK
        UUID user_id FK "ON DELETE CASCADE"
        TEXT provider "CHECK google"
        TEXT provider_id "UNIQUE (provider, provider_id)"
        TIMESTAMPTZ created_at
    }
    refresh_tokens {
        UUID id PK
        UUID user_id FK "ON DELETE CASCADE"
        TEXT token_hash UK
        TIMESTAMPTZ expires_at
        BOOLEAN revoked "DEFAULT false"
        TIMESTAMPTZ created_at
    }
    venues {
        UUID id PK
        UUID owner_id FK
        TEXT name
        TEXT slug UK
        TEXT description
        TEXT address
        TEXT district
        TEXT province
        NUMERIC_10_7 lat "NUMERIC(10,7)"
        NUMERIC_10_7 lng "NUMERIC(10,7)"
        TEXT status "DEFAULT pending, CHECK pending, approved, rejected, suspended"
        TEXT cover_url
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ deleted_at "soft delete"
    }
    venue_images {
        UUID id PK
        UUID venue_id FK "ON DELETE CASCADE"
        TEXT url
        INT sort_order "DEFAULT 0"
        TIMESTAMPTZ created_at
    }
    sports {
        UUID id PK
        TEXT name UK
        TEXT slug UK
        TEXT icon "tên icon lucide"
        INT sort_order "DEFAULT 0"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    amenities {
        UUID id PK
        TEXT name UK
        TEXT slug UK
        TEXT icon
        INT sort_order "DEFAULT 0"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    venue_sports {
        UUID venue_id PK, FK "ON DELETE CASCADE"
        UUID sport_id PK, FK "ON DELETE CASCADE"
    }
    venue_amenities {
        UUID venue_id PK, FK "ON DELETE CASCADE"
        UUID amenity_id PK, FK "ON DELETE CASCADE"
    }
    courts {
        UUID id PK
        UUID venue_id FK "ON DELETE CASCADE"
        UUID sport_id FK "nullable"
        TEXT name
        TEXT description
        TEXT status "DEFAULT active, CHECK active, inactive"
        INT sort_order "DEFAULT 0"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ deleted_at "soft delete"
    }
    opening_hours {
        UUID id PK
        UUID court_id FK "ON DELETE CASCADE"
        SMALLINT day_of_week "CHECK 0..6, UNIQUE (court_id, day_of_week)"
        TIME open_time "CHECK open_time trước close_time"
        TIME close_time
    }
    pricing_rules {
        UUID id PK
        UUID court_id FK "ON DELETE CASCADE"
        TEXT name
        INT price_per_slot "VND mỗi 30 phút"
        TIME start_time
        TIME end_time
        SMALLINT[] day_of_week "NULL = mọi ngày"
        DATE date_override "ngày lễ"
        INT priority "DEFAULT 0, cao hơn = ưu tiên hơn"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    blackout_periods {
        UUID id PK
        UUID court_id FK "ON DELETE CASCADE"
        TEXT reason
        TSTZRANGE during "NOT NULL, GiST (court_id, during)"
        TIMESTAMPTZ created_at
    }
    bookings {
        UUID id PK
        UUID court_id FK
        UUID customer_id FK
        UUID cancelled_by FK "nullable, tham chiếu users"
        TSTZRANGE during "UTC, NOT NULL"
        TEXT status "DEFAULT held, CHECK 7 trạng thái"
        INT total_price "VND, tính ở server"
        TEXT note
        TEXT cancel_reason
        TIMESTAMPTZ expires_at "chỉ dùng khi held"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    payments {
        UUID id PK
        UUID booking_id FK
        INT amount
        TEXT provider "DEFAULT vietqr"
        TEXT provider_ref
        TEXT status "DEFAULT pending, CHECK pending, completed, failed, refunded"
        TEXT idempotency_key UK "chống xử lý webhook 2 lần"
        TIMESTAMPTZ paid_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    reviews {
        UUID id PK
        UUID booking_id FK, UK
        UUID venue_id FK
        UUID customer_id FK
        SMALLINT rating "CHECK 1..5"
        TEXT content
        BOOLEAN is_visible "DEFAULT true"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    favorites {
        UUID user_id PK, FK "ON DELETE CASCADE"
        UUID venue_id PK, FK "ON DELETE CASCADE"
        TIMESTAMPTZ created_at
    }
    notifications {
        UUID id PK
        UUID user_id FK "ON DELETE CASCADE"
        TEXT type
        TEXT title
        TEXT body
        JSONB data
        TIMESTAMPTZ read_at
        TIMESTAMPTZ created_at
    }
    audit_logs {
        UUID id PK
        UUID actor_id FK "nullable"
        TEXT action
        TEXT entity_type
        UUID entity_id
        JSONB old_data
        JSONB new_data
        INET ip_address
        TIMESTAMPTZ created_at
    }

    users ||--o{ oauth_accounts : "user_id"
    users ||--o{ refresh_tokens : "user_id"
    users ||--o{ venues : "owner_id"
    users ||--o{ bookings : "customer_id"
    users |o--o{ bookings : "cancelled_by"
    users ||--o{ reviews : "customer_id"
    users ||--o{ favorites : "user_id"
    users ||--o{ notifications : "user_id"
    users |o--o{ audit_logs : "actor_id"

    venues ||--o{ venue_images : "venue_id"
    venues ||--o{ courts : "venue_id"
    venues ||--o{ venue_sports : "venue_id"
    venues ||--o{ venue_amenities : "venue_id"
    venues ||--o{ reviews : "venue_id"
    venues ||--o{ favorites : "venue_id"

    sports ||--o{ venue_sports : "sport_id"
    sports |o--o{ courts : "sport_id"
    amenities ||--o{ venue_amenities : "amenity_id"

    courts ||--o{ opening_hours : "court_id"
    courts ||--o{ pricing_rules : "court_id"
    courts ||--o{ blackout_periods : "court_id"
    courts ||--o{ bookings : "court_id"

    bookings ||--o{ payments : "booking_id"
    bookings ||--o| reviews : "booking_id"
```

**Ràng buộc và index quan trọng** (không vẽ được trong ERD, SQL đầy đủ ở mục "Chi tiết bảng"):

| Bảng | Ràng buộc / index | Mục đích |
|------|-------------------|----------|
| `bookings` | `EXCLUDE USING gist (court_id WITH =, during WITH &&) WHERE (status IN ('held','pending_payment','confirmed'))`, cần `btree_gist` | **Chống trùng lịch ở DB** (Quy tắc #2) |
| `bookings` | GiST `(court_id, during)`; B-tree `customer_id`, `status`; `expires_at WHERE status='held'` | Truy vấn lịch sân, dọn booking hết hạn giữ chỗ |
| `blackout_periods` | GiST `(court_id, during)` | Kiểm tra sân bị khóa |
| `opening_hours` | `UNIQUE (court_id, day_of_week)`, `CHECK (open_time < close_time)` | Mỗi sân một khung giờ mở cửa mỗi thứ |
| `reviews` | `UNIQUE (booking_id)` | Một booking chỉ được đánh giá một lần |
| `payments` | `UNIQUE (idempotency_key)` | Chống xử lý webhook trùng |
| `users`, `venues`, `courts` | Partial index `WHERE deleted_at IS NULL` | Soft delete |

### Ghi chú thiết kế

- **Chỉnh sửa so với ERD cũ (v1.0.0):** schema SQL không đổi. ERD cũ thiếu bảng `oauth_accounts`, `venue_images` và hai quan hệ có trong SQL: `sports → courts` (`courts.sport_id`) và `users → bookings` qua `cancelled_by`. Quan hệ `users → audit_logs` được sửa thành tùy chọn (`actor_id` cho phép NULL). Các bảng trung gian không còn bị xem là thực thể nghiệp vụ ở mức conceptual.
- **`reviews.venue_id` là dữ liệu thừa có chủ đích** (suy ra được qua `booking → court → venue`) để truy vấn điểm trung bình nhanh. Service phải gán đúng bằng venue của booking khi tạo review.
- **`courts.sport_id`** nên thuộc tập môn trong `venue_sports` của cơ sở. DB chưa ép ràng buộc này, service phải kiểm tra.
- **`pricing_rules.day_of_week SMALLINT[]`** là cột đa trị (chưa đạt 1NF). Giữ nguyên vì đơn giản hơn một bảng con và chỉ được đọc cùng rule.
- **Chưa thống nhất UUID:** mục "Quy ước chung" ghi UUID v7 nhưng SQL dùng `gen_random_uuid()` (v4). Cần quyết định khi viết migration `0001` (ghi vào `docs/18-decision-log.md`).

## Chi tiết bảng

### users
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT,                    -- NULL nếu OAuth only
  full_name   TEXT NOT NULL,
  phone       TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL CHECK (role IN ('customer','owner','admin')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role  ON users(role)  WHERE deleted_at IS NULL;
```

### oauth_accounts
```sql
CREATE TABLE oauth_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN ('google')),
  provider_id TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider, provider_id)
);
```

### refresh_tokens
```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_rt_user ON refresh_tokens(user_id) WHERE revoked = false;
```

### sports
```sql
CREATE TABLE sports (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE,   -- "Bóng đá", "Cầu lông"
  slug  TEXT NOT NULL UNIQUE,   -- "bong-da", "cau-long"
  icon  TEXT,                   -- tên icon lucide
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### amenities
```sql
CREATE TABLE amenities (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE,   -- "Bãi đỗ xe", "Phòng thay đồ"
  slug  TEXT NOT NULL UNIQUE,
  icon  TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### venues
```sql
CREATE TABLE venues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  address      TEXT NOT NULL,
  district     TEXT NOT NULL,
  province     TEXT NOT NULL,
  lat          NUMERIC(10,7),
  lng          NUMERIC(10,7),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','suspended')),
  cover_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_venues_owner   ON venues(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_status  ON venues(status)   WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_district ON venues(province, district) WHERE deleted_at IS NULL;
```

### venue_images
```sql
CREATE TABLE venue_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### venue_sports / venue_amenities (junction)
```sql
CREATE TABLE venue_sports (
  venue_id  UUID REFERENCES venues(id) ON DELETE CASCADE,
  sport_id  UUID REFERENCES sports(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, sport_id)
);

CREATE TABLE venue_amenities (
  venue_id    UUID REFERENCES venues(id) ON DELETE CASCADE,
  amenity_id  UUID REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, amenity_id)
);
```

### courts
```sql
CREATE TABLE courts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  sport_id    UUID REFERENCES sports(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_courts_venue ON courts(venue_id) WHERE deleted_at IS NULL;
```

### opening_hours
```sql
CREATE TABLE opening_hours (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id   UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=CN, 1=T2...
  open_time  TIME NOT NULL,
  close_time TIME NOT NULL,
  CHECK (open_time < close_time),
  UNIQUE (court_id, day_of_week)
);
```

### pricing_rules
```sql
CREATE TABLE pricing_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id      UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price_per_slot INT NOT NULL,           -- VND per 30-min block
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  day_of_week   SMALLINT[],             -- NULL = áp dụng mọi ngày
  date_override DATE,                   -- Ngày cụ thể (ngày lễ)
  priority      INT NOT NULL DEFAULT 0, -- Cao hơn = ưu tiên hơn
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pricing_court ON pricing_rules(court_id);
```

### blackout_periods
```sql
CREATE TABLE blackout_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id    UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  reason      TEXT,
  during      TSTZRANGE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_blackout_court ON blackout_periods USING gist (court_id, during);
```

### bookings (bảng quan trọng nhất)
```sql
-- Extension bắt buộc
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id        UUID NOT NULL REFERENCES courts(id),
  customer_id     UUID NOT NULL REFERENCES users(id),
  during          TSTZRANGE NOT NULL,         -- UTC, ví dụ: [2026-10-15 08:00+07, 2026-10-15 09:30+07)
  status          TEXT NOT NULL DEFAULT 'held'
                    CHECK (status IN ('held','pending_payment','confirmed','completed','cancelled','expired','no_show')),
  total_price     INT NOT NULL,               -- VND, tính ở server
  note            TEXT,
  cancelled_by    UUID REFERENCES users(id),
  cancel_reason   TEXT,
  expires_at      TIMESTAMPTZ,               -- Chỉ dùng cho trạng thái held
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- CONSTRAINT QUAN TRỌNG: Chống trùng lịch
  -- Chỉ áp dụng cho held, pending_payment, confirmed (không áp dụng cho cancelled/expired/no_show/completed)
  EXCLUDE USING gist (
    court_id WITH =,
    during   WITH &&
  ) WHERE (status IN ('held', 'pending_payment', 'confirmed'))
);

CREATE INDEX idx_bookings_court_during ON bookings USING gist (court_id, during);
CREATE INDEX idx_bookings_customer     ON bookings(customer_id);
CREATE INDEX idx_bookings_status       ON bookings(status);
CREATE INDEX idx_bookings_expires      ON bookings(expires_at) WHERE status = 'held';
```

### payments
```sql
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id),
  amount          INT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'vietqr',
  provider_ref    TEXT,                        -- Mã giao dịch của provider
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','failed','refunded')),
  idempotency_key TEXT NOT NULL UNIQUE,        -- Tránh xử lý webhook 2 lần
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### reviews
```sql
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL UNIQUE REFERENCES bookings(id),
  venue_id    UUID NOT NULL REFERENCES venues(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content     TEXT,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reviews_venue ON reviews(venue_id) WHERE is_visible = true;
```

### favorites
```sql
CREATE TABLE favorites (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_id   UUID REFERENCES venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, venue_id)
);
```

### notifications
```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,             -- "booking_confirmed", "booking_cancelled", ...
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notif_user_unread ON notifications(user_id) WHERE read_at IS NULL;
```

### audit_logs
```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,             -- "venue.approved", "user.suspended"
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id);
```

## Quy tắc migration

1. **Đặt tên file:** `NNNN_mô-tả-ngắn.sql` (vd: `0001_init-schema.sql`, `0002_add-blackout-periods.sql`).
2. **Mỗi migration là idempotent hoặc có rollback script tương ứng.**
3. **KHÔNG** sửa trực tiếp file migration đã được merge vào main.
4. **Constraint EXCLUDE** phải được viết trong file SQL migration tùy chỉnh (Drizzle chưa hỗ trợ native).
5. Chạy lệnh: `pnpm --filter @bsc/api db:migrate`
