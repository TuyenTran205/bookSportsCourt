## Mô tả thay đổi

<!-- Mô tả ngắn gọn PR này làm gì và tại sao -->

## Issue liên quan

Closes #<!-- số issue -->

Mã tính năng: <!-- CUS-XX / OWN-XX / ADM-XX / BSC-XXX -->

## Loại thay đổi

- [ ] `type:feature` – Tính năng mới
- [ ] `type:bug` – Sửa lỗi
- [ ] `type:task` – Tác vụ kỹ thuật (setup, config, refactor)
- [ ] `type:docs` – Chỉ cập nhật tài liệu
- [ ] `type:chore` – Dọn dẹp, cập nhật dependency

## Area

- [ ] `area:api` – Backend NestJS
- [ ] `area:web` – Frontend Next.js
- [ ] `area:shared` – packages/shared
- [ ] `area:db` – Database / Migration
- [ ] `area:infra` – CI/CD, Docker, Deploy
- [ ] `area:design` – Design system

---

## Checklist tự kiểm (TRƯỚC khi mở PR)

### Chung
- [ ] Code pass `pnpm lint` và `pnpm typecheck` không có lỗi
- [ ] Không có `any`, `@ts-ignore` không có lý do trong code mới
- [ ] Không có `console.log` thừa (production code)
- [ ] Không commit secret / API key / password vào repo
- [ ] Conventional commit message có tham chiếu `#issue`
- [ ] PR size < 400 dòng (hoặc giải thích lý do bên dưới)

### Backend (nếu có thay đổi API/DB)
- [ ] Test đã được viết cho logic nghiệp vụ mới
- [ ] Không có nghiệp vụ trong Controller (chỉ delegate)
- [ ] OpenAPI / Swagger đã được cập nhật trong cùng PR
- [ ] `11-api-contract.md` đã được cập nhật nếu thay đổi endpoint
- [ ] Migration file đã được tạo nếu thay đổi schema
- [ ] Migration đặt tên đúng format `NNNN_mô-tả.sql`

### Frontend (nếu có thay đổi UI)
- [ ] Chỉ dùng màu / spacing từ design token (không hardcode)
- [ ] Không dùng emoji làm icon (chỉ Lucide)
- [ ] Không gradient tím/xanh mặc định
- [ ] Component có đủ trạng thái: loading/empty/error/disabled
- [ ] Focus-visible hoạt động đúng (keyboard navigation)
- [ ] Touch target ≥ 44px trên mobile
- [ ] Không hardcode chuỗi (dùng next-intl `t()`)
- [ ] Responsive đã kiểm tra ở 375px và 1440px
- [ ] **Ảnh chụp màn hình 375px (mobile):** [đính kèm bên dưới]
- [ ] **Ảnh chụp màn hình 1440px (desktop):** [đính kèm bên dưới]

### Booking / Phân quyền (nếu thay đổi logic nhạy cảm)
- [ ] Unit test đã viết và pass
- [ ] Test chuyển trạng thái sai bị từ chối
- [ ] Test race condition (nếu liên quan booking)
- [ ] Guard / ownership check đã đúng

---

## Ghi chú thêm

<!-- PR size lớn hơn 400 dòng? Giải thích tại sao không thể chia nhỏ hơn -->
<!-- Thay đổi packages/shared? Đã thông báo nhóm chưa? -->
<!-- Breaking change? Mô tả cách migrate -->
