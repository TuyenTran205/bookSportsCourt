# 06 – Bảo mật & Phân quyền

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-10-12

## Ma trận Role × Resource × Action

> **Nguyên tắc:** Admin là vai trò **kiểm duyệt và quản trị**, KHÔNG thay thế hành vi của Customer hay Owner. Admin **không** tạo hold, không viết đánh giá, không thêm yêu thích, không tạo booking thủ công — những việc đó thuộc về Customer/Owner. Admin chỉ có đúng các quyền được ghi rõ là của Admin.
>
> Ma trận này phải khớp với nhãn `[Customer]` / `[Owner]` / `[Admin]` ở [11-api-contract.md](11-api-contract.md). Khi lệch, **11 là nguồn đúng** vì đó là hợp đồng API.

| Resource | Guest | Customer | Owner | Admin |
|----------|-------|----------|-------|-------|
| **Venues** – List/Search | ✅ | ✅ | ✅ | ✅ |
| **Venues** – Detail | ✅ | ✅ | ✅ | ✅ |
| **Venues** – Create | ❌ | ❌ | ✅ (chờ duyệt) | ✅ |
| **Venues** – Update | ❌ | ❌ | ✅ (sở hữu) | ✅ |
| **Venues** – Approve/Reject | ❌ | ❌ | ❌ | ✅ |
| **Courts** – CRUD | ❌ | ❌ | ✅ (sở hữu venue) | ✅ |
| **Bookings** – Create Hold | ❌ | ✅ | ❌ | ❌ |
| **Bookings** – View own | ❌ | ✅ | ✅ (venue của mình) | ❌ |
| **Bookings** – View all | ❌ | ❌ | ❌ | ✅ |
| **Bookings** – Cancel | ❌ | ✅ (theo chính sách) | ✅ (sở hữu venue) | ❌ |
| **Bookings** – Manual create / No-show | ❌ | ❌ | ✅ (sở hữu venue) | ❌ |
| **Payments** – Upload proof | ❌ | ✅ (booking của mình, đang held) | ❌ | ❌ |
| **Payments** – View | ❌ | ✅ (booking của mình) | ✅ (venue của mình) | ✅ |
| **Payments** – Approve/Reject | ❌ | ❌ | ✅ (sở hữu venue) | ❌ |
| **Payment account / Cancellation policy** – Edit | ❌ | ❌ | ✅ (sở hữu venue) | ❌ |
| **Owner applications** – Submit/View own | ❌ | ✅ | ✅ (xem) | ✅ |
| **Owner applications** – Approve/Reject | ❌ | ❌ | ❌ | ✅ |
| **Favorites** – CRUD | ❌ | ✅ | ✅ | ❌ |
| **Notifications** – View/Mark read | ❌ | ✅ | ✅ | ✅ |
| **Reviews** – Reply | ❌ | ❌ | ✅ (venue của mình) | ❌ |
| **Catalogs (sports, amenities, areas)** – Read | ✅ | ✅ | ✅ | ✅ |
| **Catalogs (sports, amenities, areas)** – CRUD | ❌ | ❌ | ❌ | ✅ |
| **Owner reports** – View | ❌ | ❌ | ✅ (venue của mình) | ❌ |
| **Admin stats** – View | ❌ | ❌ | ❌ | ✅ |
| **Pricing Rules** – CRUD | ❌ | ❌ | ✅ (sở hữu court) | ✅ |
| **Users** – View/Edit own | ❌ | ✅ | ✅ | ✅ |
| **Users** – Suspend/Activate | ❌ | ❌ | ❌ | ✅ |
| **Audit Logs** – View | ❌ | ❌ | ❌ | ✅ |
| **Reviews** – Create | ❌ | ✅ (booking completed) | ❌ | ❌ |
| **Reviews** – Hide/Show | ❌ | ❌ | ❌ | ✅ |

## Guard & Policy trong NestJS

### Luồng kiểm tra quyền

```
Request → JwtAuthGuard (xác thực) → RolesGuard (kiểm tra role) → OwnershipGuard (kiểm tra sở hữu) → Controller
```

### JwtAuthGuard
```typescript
// Xác thực JWT từ cookie httpOnly
// Ném UnauthorizedException nếu token không hợp lệ hoặc hết hạn
```

### RolesGuard
```typescript
@Roles('owner', 'admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Patch(':id/approve')
async approveVenue() { ... }
```

### OwnershipGuard
```typescript
// Kiểm tra: user.id === venue.owner_id
// Dùng decorator @CheckOwnership('venue')
// Admin bỏ qua kiểm tra sở hữu
```

## Auth – Refresh Token xoay vòng

```
1. Đăng nhập → Access Token (15 phút) + Refresh Token (30 ngày) → cookie httpOnly
2. Access Token hết hạn → FE gọi POST /auth/refresh với cookie
3. BE xác minh Refresh Token (chưa revoked, chưa hết hạn)
4. BE tạo cặp token mới, revoke token cũ
5. Nếu token cũ bị dùng lại (đã revoked) → revoke toàn bộ session của user (token theft detection)
```

## CORS

```typescript
// Chỉ cho phép domain frontend
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  credentials: true, // Cho phép gửi cookie
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});
```

## CSRF Protection

- Access/Refresh Token lưu trong cookie `httpOnly; Secure; SameSite=Lax`.
- **Bắt buộc dùng `Lax`, KHÔNG dùng `Strict`:** luồng đăng nhập Google OAuth là redirect cross-site (`accounts.google.com` → callback của BE). Với `SameSite=Strict`, trình duyệt không gửi cookie `state`/phiên theo request redirect đó, khiến callback không đọc được `state` và OAuth luôn thất bại. `Lax` vẫn gửi cookie cho điều hướng top-level bằng GET, nên luồng OAuth chạy đúng.
- `Lax` đã đủ chặn CSRF cho mutation: các request `POST/PUT/PATCH/DELETE` cross-site **không** được gửi kèm cookie.
- Với mutation quan trọng (thanh toán), thêm header `X-Request-Origin` và kiểm tra ở BE (phòng thủ nhiều lớp).

## Rate Limiting (MVP – in-memory)

```typescript
// Dùng @nestjs/throttler – không cần Redis
ThrottlerModule.forRoot([{
  name:  'global',
  ttl:   60_000,  // 1 phút
  limit: 100,     // 100 request/IP/phút
}, {
  name:  'auth',
  ttl:   300_000, // 5 phút
  limit: 10,      // 10 lần đăng nhập/5 phút
}])
```

**Ghi chú:** Chỉ hiệu quả với 1 instance. Khi scale nhiều instance, cần Redis. Ghi vào decision log.

## Chống lạm dụng giữ chỗ (Hold Abuse)

1. Mỗi customer chỉ được giữ tối đa **3 booking** trạng thái `held` cùng lúc (hằng số `HOLD_LIMIT`, cấu hình qua env — xem `.env.example`). Vượt giới hạn → **422 `HOLD_LIMIT_EXCEEDED`** (xem [11-api-contract.md](11-api-contract.md)).
2. Sau khi hold hết hạn, không được giữ lại **cùng một court** quá **5 lần trong 1 giờ** → **429 `HOLD_RATE_LIMITED`**.

**Cách đếm (rule 2)** — phải chốt rõ, nếu không mỗi người hiểu một kiểu:

- Đếm theo **cặp (customer_id, court_id)**, không phải theo customer hay theo court riêng lẻ. Một khách giữ 5 court khác nhau trong 1 giờ là hợp lệ.
- Cửa sổ **trượt 60 phút** tính từ thời điểm hiện tại (`created_at > now() - interval '1 hour'`), không phải cửa sổ cố định theo giờ đồng hồ.
- Đếm **mọi** booking đã tạo ở trạng thái `held`, `expired`, `pending_payment`, `confirmed` — kể cả `expired`. Nếu chỉ đếm `held` thì kẻ lạm dụng chỉ cần để hold hết hạn rồi giữ lại, và rule trở nên vô dụng.
- **Không** đếm `cancelled` do Owner huỷ hoặc do cron huỷ quá hạn duyệt — đó không phải hành vi của khách.

```sql
-- Kiểm tra trong cùng transaction với INSERT hold, dưới lock của customer
SELECT COUNT(*) FROM bookings
WHERE customer_id = $1 AND court_id = $2
  AND created_at > now() - interval '1 hour'
  AND status <> 'cancelled';
```

> Ngưỡng 5/giờ là để chặn việc giữ chỗ rồi thả liên tục nhằm phá người khác, chứ không nhắm vào khách đặt đi đặt lại bình thường. Nếu ngưỡng này chặn nhầm khách thật trong demo, nâng qua env `HOLD_RATE_LIMIT_PER_HOUR` thay vì sửa code.

## Quản lý PII

- Mật khẩu: Argon2id, KHÔNG lưu plaintext.
- Số điện thoại: mask khi hiển thị ở danh sách (`0912***456`).
- Audit logs không ghi PII nhạy cảm (password_hash, token).

## Quản lý Secret & Env

```
.env.example    ← Commit vào repo (chỉ key, không có value)
.env.local      ← KHÔNG commit (gitignore)
.env.production ← KHÔNG commit, lưu trong CI/CD secrets
```

**Biến môi trường bắt buộc:**
```env
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=
RESEND_API_KEY=
SENTRY_DSN=
ALLOWED_ORIGINS=
```

## Checklist trước khi deploy

- [ ] Không có `console.log` chứa data nhạy cảm
- [ ] Rate limit đã bật ở môi trường production
- [ ] CORS chỉ cho phép domain production
- [ ] Cookie `Secure=true; SameSite=Lax` ở production (xem mục CSRF Protection – `Strict` sẽ phá Google OAuth)
- [ ] Kiểm tra luồng đăng nhập Google OAuth chạy được sau khi đổi `SameSite`
- [ ] Tất cả secret được lưu ở CI/CD secrets, không phải code
- [ ] `.env.local` đã trong `.gitignore`
- [ ] Sentry đang nhận error từ cả FE và BE
- [ ] Không có endpoint admin nào accessible khi chưa auth
- [ ] SQL injection: dùng parameterized query qua Drizzle (không raw SQL interpolation)
