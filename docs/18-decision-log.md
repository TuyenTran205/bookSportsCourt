# 18 – Decision Log (ADR)

> **Phiên bản:** 1.6.1 | **Cập nhật lần cuối:** 2026-11-08
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
| 022 | Quy tắc kiểm duyệt, slug và xoá mềm Venue |
| 023 | Dependency hỗ trợ DB/Swagger khi tích hợp backend |
| 024 | Contract Phase 4: snapshot, proof private, lock protocol, session và outbox PostgreSQL |
| 025 | SDK S3 cho proof R2 private và Sharp để giải mã/chuẩn hoá ảnh |
| 026 | Google OIDC code/PKCE với jose hiện có, state mã hoá và không auto-link email |
| 027 | Bản đồ Leaflet miễn phí và Geocoding hai chiều cho hồ sơ chủ sân (Owner Application) |
| 028 | @vitejs/plugin-react cho Vitest (sửa lỗi "Invalid hook call" khi chạy cả bộ test FE) |
| 029 | Lưu tài khoản nhận tiền từ hồ sơ chủ sân và hỗ trợ CCCD 12 số |
| 030 | Bản đồ Việt Nam tự chủ PMTiles trên Cloudflare R2 với protomaps-leaflet và lớp nhãn Biển Đông |


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

**Quyết định:** **Cloudflare R2** với **presigned URL**: client xin URL từ BE rồi upload trực tiếp lên R2 cho ảnh thông thường. **Bổ sung 2026-11-06 (ADR-024):** endpoint proof thanh toán giữ multipart theo docs/11, BE nhận stream giới hạn 5 MiB rồi lưu R2 private; signed GET TTL5 phút cấp sau kiểm tra quyền. Không thêm luồng direct-presigned-proof thứ hai ngoài contract.

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

## ADR-022: Chọn Nguồn Bộ Dữ Liệu Đơn Vị Hành Chính Việt Nam Mốc 03/11/2026

**Ngày:** 2026-11-03 | **Trạng thái:** Accepted

**Bối cảnh:** Dữ liệu hành chính cũ hard-code 5 tỉnh, 9 quận, không phản ánh thực tế địa bàn hoạt động của các cụm sân thể thao trên toàn quốc. Cần nguồn dữ liệu chuẩn hóa, có mã định danh hành chính chính thức (GSO codes), tên gọi tiếng Việt có dấu, slug chuẩn URL, và tên không dấu (unaccent) cho tìm kiếm.

**Quyết định:**
- Sử dụng Bộ dữ liệu mở Đơn vị Hành chính Việt Nam được chuẩn hóa từ Tổng cục Thống kê và CSDL Quốc gia về ĐVHC, cập nhật mốc 03/11/2026.
- Phân tách cấu trúc lưu trữ:
  1. `packages/shared/src/data/provinces.ts`: Chứa 34 tỉnh/thành phố (dưới 5KB), xuất khẩu dạng mảng TypeScript định kiểu chặt chẽ, được phép import cả ở FE và BE.
  2. `packages/shared/src/data/wards.json`: Chứa 3.321 xã/phường/đặc khu (~320KB). **Chỉ dùng cho BE, Seed DB, và MSW handler server-side.** Tuyệt đối không import vào các client component của Next.js.
- Mã đơn vị hành chính dùng kiểu `string` bảo toàn số 0 ở đầu (ví dụ: Hà Nội là `'01'`, TP.HCM là `'79'`, Phường Phúc Xá là `'00001'`).

**Lý do:** Tối ưu hiệu năng, giảm bundle size phía client trong khi vẫn cung cấp khả năng tìm kiếm và định danh chính xác đến cấp xã/phường trên toàn quốc.

**Loại bỏ:** Import toàn bộ file JSON xã/phường vào frontend bundle (gây phình bundle thêm 320KB gzip).

**Hệ quả:** Truy vấn xã/phường phía client luôn thông qua API có phân trang hoặc lọc theo tỉnh (`/api/v1/provinces/:code/wards`), bảo vệ First Load JS của ứng dụng web.

---

## ADR-023: Bãi Bỏ Cấp Huyện — Chuyển Sang Mô Hình 2 Cấp (34 Tỉnh / 3.321 Xã-Phường) & Legacy Support

**Ngày:** 2026-11-03 | **Trạng thái:** Accepted

**Bối cảnh:** Thể chế quản trị hành chính Việt Nam từ 01/07/2025 bãi bỏ cấp huyện, phân bổ lại thành 34 tỉnh/thành phố và 3.321 xã/phường. Schema hiện tại đang bắt buộc `venues.district_id NOT NULL` và `areas.type IN ('province', 'district')`.

**Quyết định:**
- `areas.type` mở rộng chấp nhận `'province'`, `'ward'`, và giữ `'district'` với trạng thái legacy.
- Bổ sung cột `ward_id UUID REFERENCES areas(id)` vào bảng `venues`.
- Chuyển `district_id` thành `UUID NULL` (nullable legacy).
- Nghiệp vụ tạo mới sân (`POST /venues`) và bộ lọc chính của người dùng (`VenueFilters`) chuyển dịch sang cặp `provinceId` + `wardId`.
- Quy tắc toàn vẹn nghiệp vụ: Bắt buộc xác thực `ward.parent_id === venue.province_id` (hoặc `ward.provinceCode === venue.provinceCode`) trước khi lưu.
- **Phân định phạm vi sử dụng:** Bộ dữ liệu ĐVHC 2 cấp (34 Tỉnh/Thành phố & 3.321 Xã/Phường) là dữ liệu tham chiếu hệ thống chuẩn hóa (Master Data), phục vụ độc quyền tính năng lọc sân của Khách hàng (`VenueFilters`, `LocationSelector`) và chọn địa chỉ sân của Chủ sân (`VenueFormDialog`). **KHÔNG đưa ĐVHC vào tab quản trị thủ công trên giao diện Danh mục của Admin (`/admin/catalogs`)**. Giao diện Danh mục của Admin chỉ quản lý đúng 2 danh mục nghiệp vụ vận hành: Môn thể thao (Sports) và Tiện ích cơ sở (Amenities).

**Lý do:** Tuân thủ đúng thực tế địa giới hành chính quốc gia, tối ưu cho nghiệp vụ cốt lõi là tìm kiếm và lọc sân; bảo vệ tính toàn vẹn của dữ liệu địa bàn quốc gia cố định, tránh việc Admin sửa đổi/tạo mới tùy tiện gây sai lệch mã GSO và làm rối màn hình quản trị danh mục.

**Loại bỏ:**
- Xóa bỏ hoàn toàn cột `district_id` ngay lập tức (sẽ làm crash dữ liệu lịch sử và các booking cũ).
- Đưa tab CRUD Địa bàn & Khu vực vào trang Quản trị danh mục của Admin (`/admin/catalogs`).

**Hệ quả:** Cần migration có version cho Database; các API cũ vẫn nhận `districtId` nếu client phiên bản cũ gửi lên nhưng sẽ ưu tiên xử lý `wardId`.

---

## ADR-024: Xây Dựng LocationSelector Bằng Radix Popover & Tailwind Có Sẵn (Zero Dependency)

**Ngày:** 2026-11-03 | **Trạng thái:** Accepted

**Bối cảnh:** Cần trải nghiệm chọn Tỉnh/Thành và Xã/Phường mượt mà: người dùng có thể gõ tìm kiếm tiếng Việt không dấu, hiển thị danh sách dạng dropdown có thanh cuộn, không lag khi có nhiều dữ liệu. Theo Quy tắc #9 của `AGENTS.md`, không được tùy tiện cài thêm thư viện (như `react-select`, `downshift`, `cmdk`).

**Quyết định:**
- Tận dụng `@radix-ui/react-popover` (đã có sẵn trong `apps/web/package.json`) kết hợp với input tìm kiếm và các token Tailwind sẵn có.
- Tách logic thành component `LocationSelector` gồm 2 combobox:
  - `ProvinceCombobox`: Lấy 34 tỉnh từ bộ nhớ/React Query, lọc in-memory tức thì.
  - `WardCombobox`: Bị disable khi chưa chọn Tỉnh. Khi đã chọn Tỉnh, cho phép tìm kiếm xã/phường thuộc tỉnh đó; hỗ trợ debounce 250ms khi gõ từ khóa, giới hạn tối đa 50 kết quả hiển thị.
- Tích hợp tiện ích chuẩn hóa chuỗi `unaccent` để tìm kiếm không phụ thuộc chữ hoa/thường và dấu tiếng Việt.

**Lý do:** Tuân thủ Quy tắc #9 (Không thêm dependency khi chưa có quyết định), giữ bundle nhẹ, đạt chuẩn Anti-AI Design và trợ năng bàn phím WAI-ARIA.

**Loại bỏ:** Cài thêm `cmdk` hoặc `react-select`.

**Hệ quả:** Code UI cần xử lý focus management và keyboard navigation thủ công một cách cẩn thận bằng Radix primitives có sẵn.

---

## ADR-025: Kiểm duyệt và vòng đời Venue (BSC-014)

**Ngày:** 2026-10-30 | **Trạng thái:** Accepted (thiết kế; API chưa triển khai)

**Bối cảnh:** Contract thiếu transition, nơi lưu reason, hành vi sửa/xoá và projection; ma trận quyền cho Admin tạo/sửa trái nhãn Owner của API.

**Quyết định:** Owner-only CRUD; Admin-only status/list. Lưu lý do hiện tại ở rejection_reason nullable, migration 0007 không bịa dữ liệu legacy. Mọi thay đổi thực tế trường nội dung approved cần pending và duyệt lại; rejected sửa có thay đổi thì gửi lại pending, suspended phải được Admin đưa về pending. Slug base + UUID v7 đầy đủ, bất biến sau tạo. Xoá mềm chỉ khi không còn booking held/pending_payment/confirmed, giữ Court/lịch sử. Các luồng ghi phối hợp bằng khoá hàng Venue; shared và OpenAPI phản ánh nullable thực tế.

**Lý do:** Tránh chủ sân tự xuất bản nội dung mới bằng PATCH; URL ổn định và tên trùng không gây tranh slug; bảo toàn booking/payment và không bỏ lọt đặt mới khi DELETE chạy đồng thời.

**Hệ quả:** Sửa nội dung làm Venue tạm ẩn; booking cũ vẫn vận hành. Slug dài hơn nhưng không cần dependency. Hold quá hạn chưa được cron xử lý vẫn chặn DELETE. Các thao tác ảnh sau này phải tuân thủ duyệt lại. Legacy rejected có thể trả reason=null. Cần test HTTP/DB/concurrency khi triển khai service.

**Chi tiết và giải thích:** [Bước 2](bsc-014-step-02-business-rules.md), [contract](11-api-contract.md), [OpenAPI](openapi/bsc-014.openapi.json). Không thêm dependency.

## ADR-026: Dependency hỗ trợ công cụ DB và Swagger khi tích hợp backend

**Ngày:** 2026-11-05 | **Trạng thái:** Accepted

**Bối cảnh:** Nhánh tích hợp bổ sung công cụ DB chạy từ root và dependency Swagger. Giữ dependency và lockfile nhất quán, không đưa mật khẩu DB cố định vào script.

**Quyết định:** Giữ `dotenv`, `pg`, `drizzle-orm` cùng `drizzle-kit`/`@types/pg` tại root cho công cụ DB/cấu hình Drizzle; giữ `swagger-ui-express`/`@types/swagger-ui-express` tại apps/api theo nhánh tích hợp. Tái sử dụng phiên bản trong lockfile, không thêm thư viện khác. Công cụ DB đọc DATABASE_URL từ môi trường hoặc file env local. `packages/api` là stub, tiếp tục bị loại khỏi workspace để không trùng tên apps/api.

**Hệ quả:** Frozen install phải khớp importers root/API/shared; không tự coi root task thiếu script lint/build là đã kiểm tra thành công. Không commit giá trị env hoặc thông tin xác thực trong hướng dẫn/script.

## ADR-024: Quy tắc tích hợp Phase 4

**Ngày:** 2026-11-06 | **Trạng thái:** Accepted (thiết kế; chờ migration/code/test)

**Bối cảnh:** Phase 4 triển khai trước khi thành viên khác bàn giao Phase 2; tài liệu chưa chốt thay proof/deadline/retry, snapshot ngân hàng, thứ tự khoá và việc gửi sau commit. ADR-016 direct upload còn lệch multipart proof ở API contract.

**Quyết định:** Lưu snapshot ngân hàng tại payment khi hold; proof private qua multipart R2, proofUploadedAt giữ lần đầu, thay ảnh không gia hạn 2 giờ, URL đọc ký 5 phút. Clock quyết định deadline lấy sau lock; actor→Venue→Court→booking→payment là thứ tự tài nguyên dùng chung. Reject retry cùng reason no-op; terminal không hồi sinh. SessionVersion tăng khi suspend/reset/change-password để activate không phục hồi token cũ; status API không thao tác Admin. Google OAuth không auto-link theo email trùng.

Ghi audit/notifications/outbox cùng transaction, gửi mạng sau commit. Dùng PostgreSQL outbox/lease/idempotency key, không Redis/BullMQ (giữ ADR-004); job cleanup proof có retry. Gửi dịch vụ ngoài có delivery_unknown khi không chắc kết quả, không hứa exactly-once. Doanh thu Admin là dòng tiền amount theo paidAt trừ refund theo refundedAt, gồm cash/cọc và có thể âm theo kỳ; chỉ số user/Venue là snapshot hiện tại.

**Hệ quả:** Cần migration/shared/OpenAPI/auth rollout và test mới ở các bước sau. Không thay DB/runtime bằng tài liệu. Không thêm dependency trong Bước 1. Phải bàn giao protocol cho Phase 2 và chạy integration test thật trước khi chốt OpenAPI-3. Chi tiết quyết định, projection, mã lỗi và AC: contract Phase 4 Bước 1.

### Bổ sung BSC-045 vào ADR-024 (2026-11-06)

Worker email dùng chung Resend transport với Auth; không thêm dependency. Migration0010 bổ sung `email_request` private và `first_attempt_at`: đóng băng from/to/subject/text/html trước lần gửi đầu để retry cùng idempotency key không đổi payload. Snapshot chỉ có địa chỉ người nhận của sự kiện, tên cơ sở/sân, lịch, giá/cọc và UUID booking; không có thông tin ngân hàng, proof, họ tên/điện thoại khách khác hoặc token auth. Không expose/log snapshot; đây là dữ liệu vận hành có PII cần quyền DB hạn chế.

Claim email bằng SKIP LOCKED, lease120 giây; gửi ngoài transaction với timeout10 giây; ACK theo lease token. Tối đa5 lần mỗi chu kỳ, backoff1/5/15/60 phút. Giữ nguyên request/key khi retry vận hành. Sau23 giờ từ lần thử đầu, hoặc kết quả hết retry không chắc chắn, dừng ở delivery_unknown để đối soát. Resend giữ key24 giờ; dành1 giờ dự phòng, không tự gửi lại ngoài cửa sổ. `delivered` ở outbox nghĩa là provider chấp nhận, không phải bằng chứng tới inbox.

Cron15 phút bắt kịp mọi booking confirmed chưa bắt đầu trong24 giờ, không dùng cửa sổ15 phút dễ bỏ sót. Unique event booking/reminder ngăn enqueue trùng; notification và intent cùng transaction. `reminders_sent_at` chỉ đặt cùng ACK sau provider chấp nhận. `BUSINESS_MAIL_ENABLED=false` mặc định để local/fixture không tự gửi mail; khi bật phải đủ cấu hình, không đánh dấu thành công giả khi tắt.

Nguồn kiểm tra provider: [Resend idempotency](https://resend.com/changelog/idempotency-keys), [cơ chế header và cửa sổ](https://resend.com/blog/engineering-idempotency-keys). Thử provider thật chỉ với mailbox test được chỉ định; transport giả không thay nghiệm thu provider.

## ADR-025: SDK R2 private và kiểm tra nội dung ảnh chứng từ

**Ngày:** 2026-11-06 | **Trạng thái:** Accepted

**Quyết định:** thêm `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` vào API để dùng R2 S3 API, PUT/DELETE và signed GET TTL 300 giây; thêm `sharp` để giải mã JPEG/PNG/WebP, giới hạn pixel và chuẩn hoá lại ảnh, loại metadata/trailing payload. Dùng FileInterceptor có sẵn của Nest platform-express với memory buffer tối đa 5 MiB; không import trực tiếp dependency Multer transitive, không lưu file vào ổ đĩa/DB. Không tự viết thuật toán ký AWS.

**Hệ quả:** cấu hình R2 private fail-closed 503 khi thiếu; không dùng R2_PUBLIC_URL cho proof. SDK và decoder có test adapter/transport riêng; test DB dùng storage double không thay nghiệm thu R2 thật. Khoá phiên bản/engines tương thích Node20 và cập nhật pnpm-lock.yaml. Bucket chứng từ phải tách ảnh Venue public; không tự bật bucket public hoặc thay tài nguyên cloud trong lượt này.

**Nguồn:** [Cloudflare SDK v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/), [Nest file upload](https://docs.nestjs.com/techniques/file-upload), [Sharp](https://sharp.pixelplumbing.com/api-input/).


## ADR-026: Google OIDC và session ứng dụng dùng chung

**Ngày:** 2026-11-06 | **Trạng thái:** Accepted

**Quyết định:** dùng authorization code/OpenID Connect + PKCE S256, không thêm Passport hoặc dependency OAuth thứ hai. Tái sử dụng jose đã có để kiểm tra RS256 với JWKS Google cố định; native fetch gọi token endpoint cố định, timeout10 giây/không follow redirect. Kiểm tra issuer, audience/azp, sub, exp/iat, nonce hash và email_verified boolean true; email hợp lệ được chuẩn hoá lowercase. Không tin profile/scope/role từ query client.

State/binding/nonce độc lập32 byte; DB chỉ giữ hash, PKCE verifier mã hoá AES-256-GCM bằng OAUTH_STATE_ENCRYPTION_KEY riêng (32 byte hex), AAD=state hash. Binding cookie httpOnly/host-only/SameSite=Lax, Secure staging/production, path OAuth/10 phút. Consume state dưới lock theo clock DB và commit trước network; redaction verifier thành consumed. Lỗi/deny/replay cần bắt đầu lại. Cleanup hourly bounded500 row expired quá24 giờ, SKIP LOCKED.

Callback URI cấu hình chính xác /api/v1/auth/google/callback, không lấy Host/X-Forwarded-Host/redirect client. Frontend là origin cấu hình trong ALLOWED_ORIGINS, redirect cố định về /, không token trong URL; HTTPS ngoài local dev/test. Chỉ cấu hình Google một phần thì startup fail; không có cấu hình Google thì app vẫn chạy, endpoint503. Referrer-Policy:no-referrer/no-store cho OAuth, kể cả middleware từ chối sớm.

Liên kết bằng (google,sub), không bằng email. Provider đã liên kết đăng nhập user active hiện tại/giữ role; chưa liên kết nhưng email active đã tồn tại trả409 EMAIL_ALREADY_EXISTS kể cả Google verified. Explicit account linking ngoài MVP. Advisory transaction locks identity/email theo thứ tự chung + unique provider/email DB xử lý race; user/account/refresh cùng transaction. Reuse AuthService.sessionForGoogle và AuthCookies, user mới luôn Customer active/passwordHash null/emailVerifiedAt; không lưu Google access/refresh token. Phiên ứng dụng không persistent mặc định, version/status đọc DB.

**Hệ quả:** không cần migration/dependency; callback schema mở rộng code XOR error và metadata Google hữu hạn, không dùng metadata làm danh tính. Key rotation làm pending flow cũ hết hiệu lực, không đổi JWT session hiện có. Test real RS256/local JWKS và PostgreSQL không thay smoke Google thật. Không tự sửa cloud credentials/consent hoặc account linking để vượt lỗi email trùng.

**Nguồn:** [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Google ID-token claims](https://developers.google.com/identity/openid-connect/reference), [PKCE RFC7636](https://www.rfc-editor.org/rfc/rfc7636).

## ADR-027: Bản đồ Leaflet miễn phí và Geocoding hai chiều cho hồ sơ chủ sân (Owner Application)

**Ngày:** 2026-11-10 | **Trạng thái:** Accepted

**Bối cảnh:**
Khi khách hàng đăng ký trở thành chủ sân (`/owner/apply`), trước đây chỉ có ô text nhập địa chỉ cơ sở kinh doanh, không có tọa độ GPS. Khi cơ sở được duyệt, khách hàng tìm kiếm sân trên bản đồ sẽ không có tọa độ chính xác để ghim mốc định vị. Chủ sân cần có giao diện bản đồ trực quan để cắm ghim mốc và đồng bộ hai chiều với ô nhập địa chỉ, đồng thời cho phép mở ngoặc ghi chú bổ sung (`(* ...)`). Hệ thống yêu cầu ưu tiên chi phí 0đ (không tốn chi phí Google Maps API key).

**Quyết định:**
1. **Database & API:**
   - Thêm hai cột `lat` và `lng` (`NUMERIC(10, 7)`) vào bảng `owner_applications` thông qua migration `0011_add-owner-applications-coordinates.sql`.
   - Cập nhật `@bsc/shared` (`ownerApplicationSchema`, `OwnerApplication`, `ownerApplicationViewSchema`) và NestJS DTO, Repository, Service, Swagger để tiếp nhận và trả về tọa độ GPS.
2. **Bản đồ Frontend:**
   - Tái sử dụng component `VenueLocationMapWrapper` sử dụng Leaflet và hệ thống ngói bản đồ chuyển đổi dự phòng miễn phí (`ResilientTileLayer`: Esri World Street Map, OpenStreetMap France, Carto, OpenTopoMap) không yêu cầu API key.
3. **Geocoding & Reverse Geocoding miễn phí:**
   - Sử dụng Photon API (`photon.komoot.io`) dựa trên dữ liệu OpenStreetMap và fallback Nominatim.
   - Khi gõ địa chỉ: Debounce 700ms tự động định vị và di chuyển tâm bản đồ tới địa chỉ.
   - Khi cắm ghim trên bản đồ: Tự động đảo ngược tọa độ thành địa chỉ tiếng Việt điền vào input, giữ nguyên phần ghi chú mở ngoặc `(* Ghi chú...)` của người dùng.
4. **Hiển thị Admin:**
   - Bảng quản trị hồ sơ (`/admin/owner-applications`) hiển thị địa chỉ chi tiết và tọa độ GPS kèm liên kết xem vị trí trên bản đồ.

**Lý do:**
- Chi phí 0đ, không phụ thuộc vào quota trả phí Google Maps Platform.
- Trải nghiệm đăng ký thuận tiện, chính xác cho chủ sân; dữ liệu tọa độ sẵn sàng cho các tính năng tìm sân theo bán kính và hiển thị map tìm kiếm của người chơi (CUS-04).

**Hệ quả:**
- Cần xử lý cẩn thận độ trễ và tỷ lệ giới hạn (rate limiting) của các dịch vụ geocoding công cộng; sử dụng debounce và fallback.

---

## ADR-028: @vitejs/plugin-react cho Vitest (sửa lỗi "Invalid hook call" khi chạy cả bộ test FE)

**Ngày:** 2026-11-11 | **Trạng thái:** Accepted

**Bối cảnh:**
Khi chạy **từng file test FE riêng lẻ** (`npx vitest run <file>.test.tsx`), các test render React đều qua. Nhưng khi chạy **cả bộ 59 file** `pnpm --filter @bsc/web test`, toàn bộ 33 test render React qua `@testing-library/react` đều fail với warning *"Invalid hook call"* (reason 3: *more than one copy of React*) và lỗi `Cannot read properties of null (reading 'useCallback'/'useMemo'/'useContext')`. Điều này xảy ra kể cả với `--no-file-parallelism`, cho thấy đây không phải race giữa worker mà là **React/ReactDOM bị nạp thành 2 module identity khác nhau** khi Vite collect cả 59 file (do kết hợp pnpm symlink trên Windows + các package ESM như `@testing-library/react`; dấu vết trong stack trace: `react` nạp theo `d:\...` còn `react-dom` theo `D:\...` — khác case chữ ổ đĩa).

**Quyết định:**
1. Thêm `@vitejs/plugin-react@4` (devDependency, tương thích vite 5 / vitest 2) và dùng transform JSX qua Babel của plugin thay vì `esbuild.jsx: 'automatic'`.
2. Ghi nhận giới hạn còn lại: trên Windows + pnpm, lỗi dual-instance **vẫn có thể tái phát khi chạy cả bộ**; cách chạy tin cậy hiện nay là từng file hoặc `npx vitest run --pool=forks --no-file-parallelism`. Đã thử và loại bỏ: `resolve.dedupe`, alias react/react-dom theo đường dẫn tuyệt đối, `server.deps.inline`, tắt dep-optimizer, `environment: 'jsdom'` chung, `singleFork` + `isolate: false` — các cấu hình này hoặc không tác động, hoặc làm hỏng resolve subpath (`react/jsx-dev-runtime`).

**Lý do:**
- `@vitejs/plugin-react` là plugin chính thức của Vite cho React; transform qua Babel chuẩn hoá JSX transform cho mọi file test (bỏ phụ thuộc `esbuild.jsx`).
- Các cấu hình alias/inline thủ công gây tác dụng phụ (subpath resolve hỏng, external hoá lệch) lớn hơn lợi ích.

**Hệ quả:**
- CI/đóng góp mới cần biết: nếu full-suite FE test fail hàng loạt với "Invalid hook call" trên Windows, hãy xác nhận lại bằng cách chạy từng file — không phải lỗi code.
- Khi nâng cấp vitest/vite (≥3/≥6), cần thử lại bỏ ghi chú giới hạn trên.
- File test cần DOM vẫn khai báo `// @vitest-environment jsdom` ở đầu file.

---

## ADR-029: Lưu tài khoản nhận tiền từ hồ sơ chủ sân và hỗ trợ CCCD 12 số

**Ngày:** 2026-11-12 | **Trạng thái:** Accepted

**Bối cảnh:**
1. Khách hàng khi đăng ký làm chủ sân (`/owner/apply`) đã điền đầy đủ thông tin tài khoản ngân hàng (VietinBank, STK, Chủ TK). Tuy nhiên khi được duyệt và tạo cơ sở, trang Cài đặt & Chính sách (`/owner/settings`) lại bị trống thông tin tài khoản ngân hàng nhận tiền chuyển khoản, buộc chủ sân phải nhập lại.
2. Form đăng ký cho phép nhập số CCCD cá nhân (12 chữ số) thay cho Mã số thuế (MST 10 hoặc 13 chữ số), nhưng CSDL bảng `owner_applications` trước đó có CHECK constraint chỉ nhận 10 hoặc 13 chữ số, dẫn đến lỗi khi lưu.
3. Khi Admin lọc hồ sơ duyệt chủ sân, tab "Tất cả" chỉ trả về hồ sơ "Chờ duyệt" do schema backend ép mặc định `status: 'pending'` và repo lọc cứng theo status.
4. Màn hình chi tiết cơ sở (`/venues/[slug]`) hiển thị "Đang cập nhật giờ mở cửa" do API `publicDetail` chưa query bảng `opening_hours`.

**Quyết định:**
1. Tạo migration `0014_allow_12_digit_cccd_owner_applications.sql`: Nới lỏng CHECK constraint `chk_owner_app_tax_code` chấp nhận cả 10, 12, hoặc 13 chữ số: `CHECK (tax_code IS NULL OR tax_code ~ '^([0-9]{10}|[0-9]{12}|[0-9]{13})$')`.
2. Tạo migration `0015_add_bank_info_to_owner_applications.sql`: Bổ sung 4 cột `bank_bin`, `bank_name`, `account_no`, `account_name` vào bảng `owner_applications`.
3. Kế thừa dữ liệu: Khi cơ sở thể thao được tạo, hoặc khi gọi API `GET /owner/venues/:id/payment-account` mà cơ sở chưa từng cấu hình tài khoản riêng, hệ thống tự động fallback nạp thông tin ngân hàng từ hồ sơ chủ sân đã duyệt của người dùng đó.
4. Mở rộng `adminOwnerApplicationQuerySchema` chấp nhận `status: 'all'` để hỗ trợ tab "Tất cả" hiển thị mọi trạng thái hồ sơ.
5. Endpoint công khai `GET /venues/:idOrSlug` query thêm bảng `opening_hours` để trả về giờ mở cửa chi tiết cho từng ngày trong tuần.

**Hệ quả:**
- Không phát sinh dependency mới (tuân thủ Rule 9).
- Đảm bảo tính nhất quán dữ liệu, người dùng không phải nhập lại thông tin ngân hàng.
- Mọi thành viên khác khi pull code cần chạy migration: `pnpm --filter @bsc/api db:migrate` để đồng bộ DB.

---

## ADR-030: Bản đồ Việt Nam tự chủ PMTiles trên Cloudflare R2 với protomaps-leaflet và lớp nhãn Biển Đông

**Ngày:** 2026-11-13 | **Trạng thái:** Superseded by ADR-031

**Bối cảnh:**
Các nguồn tile công cộng hiện tại (Esri, CARTO, OSM) phụ thuộc vào máy chủ nước ngoài, khó đồng bộ màu sắc theo Design System của BookSportsCourt, không làm nổi bật các khu vực thể thao/công viên, và không chủ động kiểm soát được nhãn tiếng Việt đối với Biển Đông, Quần đảo Hoàng Sa, Quần đảo Trường Sa.

**Quyết định:**
1. Thêm `protomaps-leaflet` và `pmtiles` vào `@bsc/web` để đọc trực tiếp file vector tile `vietnam.pmtiles` đặt trên Cloudflare R2 (qua HTTP Range Request `206 Partial Content`) ngay bên trong hệ thống Leaflet hiện tại.
2. Tự thiết kế bảng màu & quy tắc vẽ vector (custom paint/label rules) tại `apps/web/lib/map/vietnam-theme.ts` đồng bộ với token màu xanh sân cỏ (`#16a34a`) và nền Slate, ưu tiên nhãn tiếng Việt (`name:vi`) và làm nổi bật các sân vận động/khu thể thao.
3. Bổ sung lớp GeoJSON tĩnh (`apps/web/public/geo/vietnam-islands.geojson`) để luôn hiển thị chuẩn xác nhãn tiếng Việt cho Biển Đông, Quần đảo Hoàng Sa và Quần đảo Trường Sa trên bản đồ.
4. Giữ nguyên hệ thống tự phục hồi `ResilientTileLayer` (SPEC-MAP-002): khi `NEXT_PUBLIC_VIETNAM_PMTILES_URL` được cấu hình, `vietnam-pmtiles` là nguồn ưu tiên cao nhất; nếu chưa cấu hình hoặc R2 lỗi/bị chặn, hệ thống tự động fallback sang Esri / OSM France / OpenTopoMap / OSM Standard.

**Lý do:**
- Tận dụng hạ tầng Cloudflare R2 sẵn có (chi phí 0đ, miễn phí egress, CDN edge tốc độ cao tại Việt Nam), không cần thuê Tile Server chạy 24/7.
- Giữ nguyên 100% component, marker, popup và bộ test Leaflet đang ổn định (`VenueMap`, `VenueLocationMap`, `SPEC-MAP-002`).

**Loại bỏ:**
- **Thay bằng `maplibre-gl`:** Yêu cầu viết lại toàn bộ component bản đồ, marker, popup và cơ chế fallback hiện có.
- **Tự dựng `TileServer GL` / `Martin`:** Tốn server chạy nền, không phù hợp kiến trúc chi phí 0đ trên Render Free.

**Hệ quả:**
- Khi bật `NEXT_PUBLIC_VIETNAM_PMTILES_URL`, bucket Cloudflare R2 bắt buộc cấu hình CORS cho phép method `GET, HEAD` và header `Range`.
- Khi chưa thiết lập `NEXT_PUBLIC_VIETNAM_PMTILES_URL`, ứng dụng hoạt động bình thường với danh sách provider miễn phí hiện tại.

---

## ADR-031: Nâng cấp Engine Bản đồ sang MapLibre GL JS (WebGL) và PMTiles Singleton Cache

**Ngày:** 2026-11-13 | **Trạng thái:** Accepted

**Bối cảnh:**
Sau khi tích hợp `protomaps-leaflet` trên nền Leaflet (ADR-030), trải nghiệm thực tế khi thu/phóng hoặc kéo bản đồ vẫn xuất hiện các ô vuông xám lộ ra trong lúc chờ tải và vẽ lại do 4 nguyên nhân:
1. CSS mặc định của Leaflet tô nền `.leaflet-container` màu xám `#ddd` lộ ra khi ô `<canvas>` mới đang render.
2. `protomaps-leaflet` vẽ vector tile bằng Canvas 2D trên luồng JS chính (CPU), nhân độ phân giải theo `window.devicePixelRatio` và có độ trễ `tileDelay`, gây chậm khung hình trên màn hình DPI cao.
3. Thư viện `pmtiles` đặt `chromeWindowsNoCache = true` ép `cache: "no-store"` khi `fetch()` trên trình duyệt nhân Chromium Windows, vô hiệu hoá HTTP disk cache của trình duyệt.
4. `ResilientTileLayer` tạo `new PMTiles(url)` mỗi lần mount với `SharedPromiseCache` mặc định chỉ 100 entry, làm mất cache RAM khi chuyển màn hình hoặc zoom/pan qua lại.

**Quyết định:**
1. Chuyển engine bản đồ `@bsc/web` từ `leaflet` / `react-leaflet` / `protomaps-leaflet` sang **`maplibre-gl`** (WebGL 60fps trên GPU) kết hợp **`@protomaps/basemaps`** để sinh MapLibre Style Spec v8 (vẫn dùng bảng màu Slate + nhấn xanh sân thể thao `#16a34a`, ưu tiên nhãn tiếng Việt `name:vi`).
2. Tạo lớp `PMTiles` Singleton (`apps/web/lib/map/pmtiles-protocol.ts`) dùng chung `SharedPromiseCache(1000)` kết hợp LRU cache tile trong RAM (512 tile gần nhất) và đăng ký giao thức `pmtiles://` duy nhất một lần qua `maplibregl.addProtocol`.
3. Upload bộ font glyphs `.pbf` mã nguồn mở hỗ trợ tiếng Việt (`Noto Sans Regular/Medium/Italic`) lên Cloudflare R2 (`scripts/map/upload-r2-fonts.mjs`) để MapLibre render nhãn tiếng Việt không tốn phí (fallback về CDN Protomaps miễn phí nếu không cấu hình `NEXT_PUBLIC_MAP_GLYPHS_URL`).
4. Chuyển lớp chủ quyền **Biển Đông**, **Quần đảo Hoàng Sa**, **Quần đảo Trường Sa** (`vietnam-islands.json`) sang GeoJSON source + `symbol` layer trên WebGL, tự động gắn lại kể cả khi fallback sang nguồn raster dự phòng (Esri / OSM).
5. Giữ nguyên giao diện props `VenueMapProps`, `VenueLocationMapProps` và cơ chế tự phục hồi `SPEC-MAP-002` thông qua `map.setStyle(buildRasterFallbackStyle(provider))`.

**Lý do:**
- MapLibre GL JS render trên GPU ở tốc độ 60fps và tự động giữ tile mức zoom cũ phóng to tạm thời (overzoom mượt) trong lúc chờ tile mới, triệt tiêu hoàn toàn hiện tượng nháy ô vuông xám khi thu/phóng.
- Vẫn đảm bảo chi phí **0đ** (BSD-3-Clause, không cần API key, dùng chung bucket R2 và CORS sẵn có).

**Loại bỏ:**
- **Chỉ giữ Leaflet + tối ưu thông số `protomaps-leaflet`:** Giảm được một phần độ trễ nhưng vẫn render Canvas 2D trên CPU, không có hiệu ứng overzoom WebGL 60fps.

**Hệ quả:**
- Cần gỡ bỏ `leaflet`, `react-leaflet`, `@types/leaflet`, `protomaps-leaflet` khỏi `@bsc/web` và cập nhật CSS sang `maplibre-gl/dist/maplibre-gl.css`.
- Thiết bị người dùng cần hỗ trợ WebGL; bổ sung UI fallback thân thiện nếu khởi tạo WebGL thất bại hoặc mất context (`webglcontextlost`).

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
