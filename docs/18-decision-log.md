# 18 – Decision Log (ADR)

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30
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

## ADR-006: Payment Sandbox (VietQR Mock)

**Ngày:** 2026-09-30 | **Trạng thái:** Accepted

**Quyết định:** Payment ở chế độ SANDBOX/MOCK, thiết kế interface để thay thế sau.

**Lý do:**
- Đồ án không nhận tiền thật; sandbox đủ để demo flow.
- Interface `PaymentAdapter` abstract → dễ thay SePay/Casso/PayOS thật sau.
- Tránh thủ tục đăng ký tài khoản merchant, KYC.

**Interface:**
```typescript
interface PaymentAdapter {
  initiate(booking: Booking): Promise<PaymentInitiateResult>;
  verify(ref: string): Promise<PaymentVerifyResult>;
  refund(paymentId: string): Promise<void>;
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
