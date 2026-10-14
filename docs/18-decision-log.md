# 18 – Decision Log (ADR)

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-10-12
>
> Mọi quyết định kiến trúc quan trọng được ghi ở đây. **Thêm dependency mới PHẢI có ADR.**

| ADR | Quyết định |
|-----|-----------|
| 001 | Tách FE và BE qua REST API |
| 002 | NestJS cho Backend |
| 003 | PostgreSQL + btree_gist + EXCLUDE constraint |
| 004 | Không dùng Redis/BullMQ ở MVP |
| 005 | Drizzle ORM |
| 006 | Thanh toán chuyển khoản QR + Owner duyệt |
| 007 | Monorepo pnpm + Turborepo |
| 008 | Dark mode – Không làm ở MVP |
| 009 | Danh mục khu vực dạng bảng `areas` |
| 010 | Owner duyệt booking bằng ảnh chuyển khoản |
| 011 | UUID v7 làm khoá chính |
| 012 | Bộ thư viện frontend (Next.js, Tailwind, shadcn/ui, TanStack Query, Zustand) |
| 013 | Socket.IO cho realtime |
| 014 | Leaflet + OpenStreetMap thay Google Maps |
| 015 | Xác thực bằng JWT trong cookie httpOnly + Argon2 |
| 016 | Cloudflare R2 để lưu ảnh |
| 017 | Resend cho email giao dịch |
| 018 | Sentry để giám sát lỗi |
| 019 | Vercel + Railway/Render + Neon |
| 020 | Bộ công cụ kiểm thử (Vitest, Supertest, Playwright) |
| 021 | Sinh mã QR phía client |

> ADR-012 → ADR-021 được bổ sung ngày 2026-10-12 để khớp quy tắc "mọi dependency phải có ADR". Trước đó các công nghệ này đã dùng trong kiến trúc và code mẫu nhưng chưa có ADR ghi lại lý do.

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

## ADR-012: Bộ thư viện frontend (Next.js, Tailwind, shadcn/ui, TanStack Query, Zustand)

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Cần chốt stack FE trước khi chia việc. Các lựa chọn này trước đây chỉ xuất hiện trong sơ đồ kiến trúc và code mẫu, chưa có ADR nào ghi lại lý do — vi phạm quy tắc "không thêm dependency khi chưa có ADR".

**Quyết định:** Dùng **Next.js 14 (App Router) + React 18 + TypeScript**, **Tailwind CSS 3** với **shadcn/ui** (component copy vào repo, không phải thư viện đóng gói), icon **Lucide**, **TanStack Query v5** cho server state, **Zustand 4** cho UI state cục bộ, **Zod** cho validate dùng chung với BE, **next-intl** cho i18n, **Framer Motion** cho animation.

**Lý do:**
- **Next.js App Router:** SEO cho trang sân là yêu cầu thật (khách tìm qua Google); Server Component cho trang chi tiết sân giảm JS gửi xuống máy khách. Deploy Vercel free tier khớp ngân sách đồ án.
- **shadcn/ui:** code nằm trong repo nên sửa được trực tiếp, không bị kẹt khi thư viện đổi API; không thêm dependency runtime.
- **TanStack Query:** lưới slot cần cache, invalidate và merge dữ liệu realtime; tự viết sẽ trùng lặp và dễ sai. Zustand chỉ giữ state UI (filter, modal) — tách hai loại state để không nhầm "server state" với "UI state".
- **Zod:** dùng chung schema giữa FE và BE qua `packages/shared`, tránh viết validate hai lần và lệch nhau.

**Loại bỏ:**
- **Pages Router:** không dùng được Server Component, và dự án mới nên theo App Router.
- **MUI / Ant Design:** nặng, khó tuỳ biến theo design system riêng, và bundle lớn hơn đáng kể trên mobile.
- **Redux Toolkit:** quá mức cần thiết; phần lớn state ở đây là server state, đã có TanStack Query lo.
- **CSS-in-JS (styled-components/emotion):** không chơi tốt với Server Component, và Tailwind đã đủ.

**Hệ quả:** Ghim phiên bản ở [03-architecture.md](03-architecture.md#phiên-bản-stack-ghim-cứng). Thêm bất kỳ thư viện nào ngoài danh sách này phải mở ADR mới.

---

## ADR-013: Socket.IO cho realtime

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Nhiều khách xem cùng một lưới slot; một người giữ chỗ thì những người khác phải thấy ngay. Không có realtime thì phải polling, vừa trễ vừa tốn request (free tier có giới hạn).

**Quyết định:** Dùng **Socket.IO 4** với room `venue:{venueId}:date:{date}` cho lưới slot và room `user:`/`owner:` cho thông báo cá nhân.

**Lý do:**
- Socket.IO tự động fallback (WebSocket → HTTP long-polling) khi mạng chặn WebSocket — quan trọng vì khách dùng 3G/4G và wifi công cộng.
- Có sẵn room, ack, và reconnect tự động; WebSocket thuần phải tự viết hết.
- NestJS có `@nestjs/websockets` + `@nestjs/platform-socket.io` chính thức.

**Loại bỏ:**
- **WebSocket thuần:** phải tự làm room, heartbeat, fallback, reconnect.
- **SSE:** một chiều, không đủ cho `join_venue`.
- **Polling:** độ trễ cao, và ở free tier dễ đụng rate limit.

**Hệ quả:** Socket cần sticky session nếu BE scale nhiều instance. Ở MVP chỉ 1 instance nên chưa cần; khi scale phải thêm Redis adapter (xem [ADR-004](#adr-004-không-dùng-redisbullmq-ở-mvp)).

---

## ADR-014: Leaflet + OpenStreetMap thay Google Maps

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Cần bản đồ hiển thị vị trí sân (GST-02) và bản đồ chọn vị trí khi Owner tạo venue.

**Quyết định:** Dùng **Leaflet** + tile **OpenStreetMap**.

**Lý do:**
- Google Maps Platform yêu cầu thẻ tín dụng và tính phí theo lượt tải bản đồ; hạn mức miễn phí $200/tháng có thể vượt nếu demo nhiều. OSM miễn phí hoàn toàn.
- Leaflet là thư viện mở, không cần API key, không ràng buộc điều khoản thương mại.
- Đủ nhu cầu: marker, popup, geocoding cơ bản (qua Nominatim).

**Loại bỏ:**
- **Google Maps:** chi phí và yêu cầu thẻ; không cần độ chính xác địa chỉ ở mức đó.
- **Mapbox:** free tier tốt nhưng vẫn cần tài khoản + API key, và vượt hạn mức sẽ bị tính phí.

**Hệ quả:** Chất lượng ảnh vệ tinh và geocoding thấp hơn Google. Chấp nhận được — người dùng chủ yếu cần biết sân ở khu vực nào. Tile OSM có giới hạn fair-use, không được dùng cho lưu lượng thương mại lớn.

---

## ADR-015: Xác thực bằng JWT trong cookie httpOnly + Argon2

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Cần cơ chế phiên cho web app có cả SSR (Next.js) và client component, đồng thời chống XSS và CSRF.

**Quyết định:** **Access token + refresh token** ký JWT, lưu trong cookie **`httpOnly; Secure; SameSite=Lax`**. Mật khẩu băm bằng **Argon2id**. Xác thực qua **Passport** với chiến lược JWT đọc token từ cookie.

**Lý do:**
- `httpOnly` khiến JS không đọc được token → XSS không lấy được phiên.
- Cookie tự gửi kèm request nên Server Component đọc được phiên mà không cần lớp trung gian.
- **Argon2id** thắng bcrypt ở khả năng chống tấn công GPU/ASIC; là lựa chọn được khuyến nghị hiện nay cho băm mật khẩu.
- `SameSite=Lax` (không phải `Strict`) là bắt buộc để luồng Google OAuth redirect hoạt động — xem [06-security-and-permissions.md](06-security-and-permissions.md).

**Loại bỏ:**
- **Token trong localStorage:** dễ bị XSS đánh cắp; đây là lý do chính không chọn.
- **Session server-side + Redis:** cần Redis, mà MVP không dùng (xem [ADR-004](#adr-004-không-dùng-redisbullmq-ở-mvp)).
- **bcrypt:** vẫn chấp nhận được nhưng Argon2id tốt hơn ở cùng chi phí triển khai.

**Hệ quả:** Cookie cần `Secure` ở production → **bắt buộc HTTPS**. Refresh token phải thu hồi được khi đăng xuất hoặc đổi mật khẩu (bảng `refresh_tokens`). Vì token nằm trong cookie, CSRF vẫn là mối quan tâm → giữ kiểm tra `X-Request-Origin` cho mutation quan trọng.

---

## ADR-016: Cloudflare R2 để lưu ảnh

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Cần lưu ảnh venue và **ảnh xác nhận chuyển khoản**. Ảnh chuyển khoản là dữ liệu nhạy cảm — không được public.

**Quyết định:** **Cloudflare R2** với **presigned URL**: client xin URL từ BE rồi upload trực tiếp lên R2, không qua BE.

**Lý do:**
- Free tier 10 GB + 10M request/tháng, và **không tính phí egress** — khác S3.
- Presigned URL tránh đẩy file lớn qua BE (tiết kiệm RAM/CPU của free tier 500 MB).
- Tương thích API S3 nên đổi nhà cung cấp sau này không phải viết lại.

**Loại bỏ:**
- **Lưu file trong ổ đĩa BE:** Railway/Render free tier có ổ đĩa ephemeral, mất file mỗi lần deploy.
- **Lưu ảnh trong DB:** phình DB, Neon free chỉ 0.5 GB.
- **S3 trực tiếp:** tính phí egress.

**Hệ quả:** Ảnh xác nhận chuyển khoản **phải** ở bucket private, chỉ truy cập qua URL có chữ ký hết hạn ngắn. Ảnh venue có thể ở bucket public hoặc cũng dùng presigned URL.

---

## ADR-017: Resend cho email giao dịch

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Cần gửi email xác thực, đặt lại mật khẩu, xác nhận booking.

**Quyết định:** Dùng **Resend** (free tier 3,000 email/tháng).

**Lý do:** API hiện đại, SDK TypeScript tốt, free tier đủ cho đồ án, và không cần dựng SMTP server. Cấu hình DKIM/SPF đơn giản để tránh vào spam.

**Loại bỏ:**
- **SMTP tự dựng (Gmail SMTP):** giới hạn thấp, dễ bị chặn, không phù hợp môi trường production.
- **SendGrid/Mailgun:** free tier ổn nhưng UI và SDK kém thuận tiện hơn cho dự án nhỏ.

**Hệ quả:** Phụ thuộc dịch vụ ngoài. Email ở môi trường dev nên dùng chế độ test/log thay vì gửi thật, để không đốt hạn mức.

---

## ADR-018: Sentry để giám sát lỗi

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Không có ai trực log; lỗi ở production (đặc biệt trong tuần demo) cần được phát hiện.

**Quyết định:** **Sentry** cho cả FE và BE (free tier 5,000 event/tháng).

**Lý do:** Bắt lỗi ở cả hai phía với stack trace đầy đủ và source map; free tier đủ cho lưu lượng đồ án. Tự dựng hệ thống log tập trung là quá sức với thời lượng đồ án.

**Loại bỏ:** **Log file + xem tay:** không phát hiện được lỗi phía client, và không ai ngồi đọc log liên tục.

**Hệ quả:** Phải cấu hình để **không** gửi dữ liệu nhạy cảm (token, ảnh chuyển khoản, thông tin cá nhân) lên Sentry.

---

## ADR-019: Vercel + Railway/Render + Neon

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Cần môi trường deploy miễn phí cho FE, BE và DB trong một học kỳ.

**Quyết định:** **Vercel** cho FE, **Railway hoặc Render** cho BE, **Neon** cho PostgreSQL.

**Lý do:** Cả ba đều có free tier thật (không chỉ dùng thử), deploy từ GitHub tự động, và khớp với stack (Next.js tối ưu trên Vercel; Neon là Postgres 16 có `btree_gist`).

**Loại bỏ:**
- **Tự dựng VPS:** tốn thời gian quản trị, không phù hợp thời lượng đồ án.
- **Supabase:** tốt nhưng gộp nhiều thứ không cần (auth, storage) và dễ lệch khỏi thiết kế đã chốt.

**Hệ quả:** Free tier có **sleep** (Railway/Render sau 15 phút, Neon pause sau 5 ngày) → cần endpoint health và keep-alive. **Vercel Hobby cấm dùng thương mại** — đồ án phi thương mại là hợp lệ. Xem [13-deployment-and-cost.md](13-deployment-and-cost.md).

---

## ADR-020: Bộ công cụ kiểm thử

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Cần test cho logic nghiệp vụ (đặc biệt chống trùng lịch), API, và luồng người dùng.

**Quyết định:** **Vitest** cho unit/integration, **Supertest** cho API, **Playwright** cho E2E. Test DB chạy trên PostgreSQL thật (không mock) vì ràng buộc `EXCLUDE` là thứ cần kiểm chứng.

**Lý do:**
- **Vitest** nhanh, cấu hình đơn giản, chạy tốt với TypeScript/ESM.
- **Supertest** là chuẩn cho NestJS, test được cả guard và interceptor.
- **Playwright** chạy được nhiều trình duyệt và có trace khi fail — hữu ích khi demo.
- Test trên Postgres thật là bắt buộc: mock không tái hiện được hành vi `EXCLUDE`, vốn là cơ chế chống trùng lịch cốt lõi.

**Loại bỏ:**
- **Jest:** chậm hơn với ESM/TS và cấu hình rườm rà hơn Vitest.
- **Cypress:** chỉ chạy Chromium ở bản free, và chậm hơn Playwright.
- **Mock DB (sqlite/in-memory):** không kiểm chứng được `EXCLUDE` và `tstzrange` — đúng những thứ dễ sai nhất.

**Hệ quả:** CI phải dựng service PostgreSQL (xem `.github/workflows/ci.yml`). Job `e2e` chạy Playwright tách riêng vì chậm hơn.

---

## ADR-021: Sinh mã QR phía client

**Ngày:** 2026-10-12 | **Trạng thái:** Accepted

**Bối cảnh:** Màn hình thanh toán cần hiện mã QR chuyển khoản ngân hàng của chủ sân với số tiền và nội dung điền sẵn.

**Quyết định:** Sinh ảnh QR **ở client** bằng thư viện JS, từ dữ liệu BE trả về (`bank_code`, `account_number`, `account_name`, `amount`, `transfer_code`).

**Lý do:** Chuỗi mã QR chuyển khoản chỉ là văn bản theo chuẩn EMVCo — sinh ở client không cần round-trip, không tốn CPU/ảnh lưu trữ ở BE, và hiển thị ngay khi mở trang. BE chỉ trả dữ liệu tài khoản chủ sân, không phải ảnh.

**Loại bỏ:**
- **Sinh ảnh ở BE rồi lưu R2:** tốn storage và thêm một bước không cần thiết.
- **Gọi API sinh QR của bên thứ ba:** phụ thuộc dịch vụ ngoài và có thể bị giới hạn tần suất.

**Hệ quả:** Nội dung chuyển khoản (`transfer_code`) **phải** được sinh ở BE và lưu DB (có ràng buộc duy nhất) — client chỉ hiển thị, không tự sinh, nếu không Owner không đối soát được.

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
