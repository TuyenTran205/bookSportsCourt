# 18 – Decision Log (ADR)

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-07
>
> Mọi quyết định kiến trúc quan trọng được ghi ở đây. Thêm dependency mới PHẢI có ADR.

---

## ADR-001: Tách FE và BE qua REST API

**Ngày:** 2026-09-30 | **Trạng thái:** Accepted

**Bối cảnh:** Cần kiến trúc cho web app đặt sân thể thao với khả năng mở rộng sang mobile.

**Quyết định:** FE (Next.js) và BE (NestJS) hoàn toàn tách biệt, giao tiếp qua REST API + Socket.IO. Next.js KHÔNG chứa nghiệp vụ, KHÔNG truy cập DB trực tiếp.

**Lý do:**
- Dễ chia việc độc lập giữa FE team và BE team.
- Mobile app (Phase 6) dùng lại toàn bộ API mà không thay đổi BE.
- Dễ test độc lập (unit test BE không cần browser).
- OpenAPI làm hợp đồng rõ ràng, tránh miscommunication.

**Hệ quả:** Tốn thêm công cấu hình CORS, cookie, deploy 2 service riêng.

---

## ADR-002: NestJS cho Backend

**Ngày:** 2026-09-30 | **Trạng thái:** Accepted

**Quyết định:** Dùng NestJS + TypeScript cho BE.

**Lý do:**
- TypeScript strict nhất quán với FE.
- Module system rõ ràng, dễ chia việc theo module (AuthModule, BookingModule...).
- Tích hợp sẵn Swagger, Guards, Interceptors, Schedule.
- Cộng đồng lớn, dễ tìm tài liệu.

**Loại bỏ:** Express.js thuần (thiếu cấu trúc), Fastify (ít tài liệu NestJS + Fastify).

---

## ADR-003: PostgreSQL + btree_gist + EXCLUDE constraint

**Ngày:** 2026-09-30 | **Trạng thái:** Accepted

**Quyết định:** PostgreSQL với extension `btree_gist` và kiểu `tstzrange`; dùng EXCLUDE constraint để chống đặt trùng lịch.

**Lý do:**
- EXCLUDE constraint là tuyến phòng thủ DB-level, không phụ thuộc logic application.
- `tstzrange` biểu diễn chính xác khoảng thời gian, hỗ trợ toán tử overlap (`&&`) native.
- Không có race condition kể cả khi nhiều instance BE chạy song song.
- PostgreSQL free tier tốt (Neon, Supabase).

**Hệ quả:** Extension `btree_gist` phải được enable trong migration đầu tiên. Drizzle chưa hỗ trợ EXCLUDE native → viết migration SQL tùy chỉnh.

**Loại bỏ:** MySQL (không có EXCLUDE), MongoDB (không có ACID transaction đủ mạnh cho bài toán này).

---

## ADR-004: Không dùng Redis/BullMQ ở MVP

**Ngày:** 2026-09-30 | **Trạng thái:** Accepted

**Quyết định:** MVP KHÔNG dùng Redis hoặc BullMQ.

**Lý do:**
- Chỉ chạy 1 instance BE trong đồ án → không cần distributed queue.
- Cron job (@nestjs/schedule in-memory) đủ cho expire holds.
- Rate limiting in-memory (@nestjs/throttler) đủ cho 1 instance.
- Thêm Redis tăng chi phí (dù có free tier) và phức tạp deploy.

**Khi nào thêm Redis:** Khi scale nhiều instance BE hoặc cần rate-limit phân tán hoặc job queue thực sự async. Phải tạo ADR mới.

---

## ADR-005: Drizzle ORM

**Ngày:** 2026-09-30 | **Trạng thái:** Accepted

**Quyết định:** Dùng Drizzle ORM thay vì Prisma hoặc TypeORM.

**Lý do:**
- Type-safe, schema-first, nhẹ hơn Prisma.
- Hỗ trợ raw SQL khi cần (quan trọng cho EXCLUDE constraint).
- Drizzle Studio cho dev trực quan.
- Không có Prisma Accelerate dependency.

**Hệ quả:** EXCLUDE constraint phải viết trong file SQL migration tùy chỉnh (không generate được từ Drizzle schema).

---

## ADR-006: Thanh toán chuyển khoản QR + Owner duyệt

**Ngày:** 2026-09-30 (cập nhật 2026-10-07) | **Trạng thái:** Accepted (thay thế bản "Payment Sandbox / Mock")

**Quyết định:** Người đặt chuyển khoản qua mã QR của chủ sân, lúc xác nhận thanh toán gửi ảnh đã chuyển khoản lên hệ thống để chủ sân đối soát và duyệt hoặc từ chối. Không có webhook ngân hàng ở MVP.

**Lý do:**
- Đồ án không nhận tiền thật và không có merchant account; luồng này khớp cách chủ sân nhỏ vận hành ngoài đời.
- Owner là người duy nhất xác nhận đã nhận tiền, nên không cần tích hợp bên thứ ba.
- Vẫn giữ `PaymentAdapter` để thay bằng SePay/Casso/PayOS (webhook tự động) sau này.

**Hệ quả:**
- Booking đi `held → pending_payment → confirmed`; `pending_payment` vẫn chiếm block (xem `05-booking-and-realtime.md`).
- Quá 2 giờ Owner chưa xử lý thì cron huỷ booking (`OWNER_REVIEW_TIMEOUT`).
- Không đối soát tự động: rủi ro ảnh giả thuộc về Owner; ghi rõ trong báo cáo.
- Bảng mới: `venue_payment_accounts`, `cancellation_policies`; `payments` có `transfer_code`, `proof_url`, `reviewed_by`.

**Interface giữ lại cho giai đoạn sau:**
```typescript
interface PaymentAdapter {
  initiate(booking: Booking): Promise<PaymentInitiateResult>; // MVP: trả dữ liệu QR + transfer_code
  verify(ref: string): Promise<PaymentVerifyResult>;          // MVP: Owner duyệt thủ công
  refund(paymentId: string): Promise<void>;                   // MVP: đánh dấu refunded, chuyển tiền ngoài hệ thống
}
```

---

## ADR-007: Monorepo pnpm + Turborepo

**Ngày:** 2026-09-30 | **Trạng thái:** Accepted

**Quyết định:** Monorepo với pnpm workspaces và Turborepo.

**Lý do:**
- `packages/shared` dùng chung Zod schema, type, hằng số giữa FE và BE – không duplicate.
- pnpm nhanh hơn npm, hỗ trợ workspaces tốt.
- Turborepo cache build, test giữa các lần run → CI nhanh hơn.
- Sau này thêm `apps/mobile` không cần repo mới.

**Hệ quả:** Cấu hình phức tạp hơn single-repo; TV4 phụ trách setup Phase 0.

---

## ADR-008: Dark mode – Không làm ở MVP

**Ngày:** 2026-09-30 | **Trạng thái:** Accepted

**Quyết định:** MVP không có dark mode.

**Lý do:** Tiết kiệm thời gian phát triển; design token đã dùng CSS variables sẵn sàng cho dark mode sau.

**Khi nào thêm:** Phase 5+ nếu còn thời gian; phải tạo ADR mới và cập nhật `07-design-system.md` trước.

---

## ADR-009: Danh mục khu vực dạng bảng `areas`

**Ngày:** 2026-10-07 | **Trạng thái:** Accepted

**Quyết định:** Khu vực hai cấp (tỉnh/thành, quận/huyện) lưu trong bảng `areas`; `venues` dùng `province_id` và `district_id` thay cho hai cột TEXT.

**Lý do:** ADM-06 yêu cầu Admin quản lý danh mục khu vực; FK ngăn nhập sai chính tả và cho phép lọc chính xác, không cần tách chuỗi.

**Hệ quả:** xoá khu vực đang dùng trả `RESOURCE_IN_USE`; service phải kiểm tra `district_id` là con của `province_id`; cần seed danh sách tỉnh/quận.

---

## ADR-010: Owner duyệt booking bằng ảnh chuyển khoản

**Ngày:** 2026-10-07 | **Trạng thái:** Accepted

**Quyết định:** Có bước Owner duyệt (OWN-09) giữa `pending_payment` và `confirmed`; thêm endpoint `approve` cho payment. Chi tiết luồng ở ADR-006 và `05-booking-and-realtime.md`.

**Lý do:** Tài liệu cũ mâu thuẫn (tính năng nói Owner duyệt, state machine chỉ có webhook). Giải quyết theo thực tế vận hành: Owner là người xác nhận đã nhận tiền.

**Hệ quả:** booking `pending_payment` vẫn chiếm block; cron huỷ sau `OWNER_REVIEW_TIMEOUT`; cần thêm sự kiện realtime `payment_submitted`.

---

## ADR-011: Dùng UUID v7 làm khoá chính, sinh ở tầng ứng dụng

**Ngày:** 2026-10-07 | **Trạng thái:** Accepted

**Quyết định:** Mọi khoá chính là `UUID` v7. ID được sinh trong code bằng `v7()` của thư viện `uuid` (gắn qua `$defaultFn` trong Drizzle schema), không dùng `gen_random_uuid()` làm nguồn chính.

**Lý do:**
- v7 có phần đầu là timestamp nên các hàng mới được chèn gần cuối index B-tree, ít phân mảnh hơn v4 ngẫu nhiên; thứ tự ID gần với thứ tự tạo, tiện sắp xếp và phân trang.
- Vẫn không đoán được ID kế tiếp và không lộ số lượng bản ghi như ID tăng dần.
- PostgreSQL 16 (phiên bản dự án dùng) chưa có hàm `uuidv7()`; hàm này mới có từ PostgreSQL 18, nên sinh ở app là cách đơn giản nhất.

**Hệ quả:**
- Kiểu cột vẫn là `UUID`, không đổi schema. SQL mẫu giữ `DEFAULT gen_random_uuid()` chỉ làm dự phòng cho seed hoặc SQL thủ công.
- Mọi insert phải đi qua Drizzle để có `$defaultFn`; script seed dùng cùng hàm sinh ID.
- ID lộ thời điểm tạo (phần timestamp). Chấp nhận được vì `created_at` đã công khai ở nhiều resource; không dùng ID làm bí mật.
- Nâng PostgreSQL lên 18 thì có thể đổi sang `DEFAULT uuidv7()` bằng migration mới.

---

## Template ADR mới

```markdown
## ADR-XXX: [Tên quyết định]

**Ngày:** YYYY-MM-DD | **Trạng thái:** Proposed / Accepted / Deprecated / Superseded by ADR-YYY

**Bối cảnh:** [Tại sao cần quyết định này]

**Quyết định:** [Quyết định cụ thể]

**Lý do:** [Giải thích tại sao chọn phương án này]

**Loại bỏ:** [Các phương án khác đã xem xét]

**Hệ quả:** [Tác động, trade-off]
```
