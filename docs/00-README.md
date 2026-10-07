# 00 – Mục lục tài liệu BookSportsCourt

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30 | **Người duy trì:** Tech Lead

## Mục lục & Thứ tự đọc

| File | Tên | Đọc khi nào |
|------|-----|-------------|
| `AGENTS.md` | Quy tắc tối thượng | **Luôn luôn đầu tiên** |
| `00-README.md` | Mục lục này | Ngay sau AGENTS.md |
| `01-product-overview.md` | Tổng quan sản phẩm | Tất cả thành viên |
| `02-features-by-role.md` | Tính năng theo vai trò | Khi nhận issue mới |
| `03-architecture.md` | Kiến trúc hệ thống | BE + FE lead |
| `04-database-schema.md` | Schema DB | TV1, TV2 (BE) |
| `05-booking-and-realtime.md` | Đặt sân & realtime | **Bắt buộc TV2** |
| `06-security-and-permissions.md` | Bảo mật & phân quyền | Tất cả |
| `07-design-system.md` | Design System | TV3, TV4 (FE) |
| `08-ui-quality-rules.md` | Quy tắc chất lượng UI | Mọi PR có UI |
| `09-frontend-conventions.md` | Quy ước FE | TV3, TV4 |
| `10-backend-conventions.md` | Quy ước BE | TV1, TV2 |
| `11-api-contract.md` | Hợp đồng API | Tất cả |
| `12-coding-standards.md` | Tiêu chuẩn code | Tất cả |
| `13-deployment-and-cost.md` | Deploy & chi phí | TV4 + nhóm |
| `14-github-workflow.md` | Quy trình GitHub | Tất cả |
| `15-team-and-roadmap.md` | Phân công & lộ trình | Tất cả |
| `16-backlog.md` | Backlog issue | Khi planning |
| `17-report-outline.md` | Dàn ý báo cáo | Khi viết báo cáo |
| `18-decision-log.md` | Nhật ký quyết định | Khi thêm dep/thay đổi lớn |

## Nguyên tắc cập nhật tài liệu

> **Quy tắc vàng:** Thay đổi quy tắc hoặc tài liệu PHẢI được thực hiện trong cùng PR với code liên quan.

1. **Sửa quy ước code** → cập nhật `12-coding-standards.md` trong cùng PR.
2. **Thêm/sửa endpoint** → cập nhật `11-api-contract.md` + OpenAPI spec trước khi chia việc FE/BE.
3. **Thêm/sửa bảng DB** → cập nhật `04-database-schema.md` + tạo file migration.
4. **Thêm dependency mới** → ghi vào `18-decision-log.md` trước.
5. **Thay đổi design system** → cập nhật `07-design-system.md` trước khi code component.
6. **Thêm tính năng** → cập nhật `02-features-by-role.md` và tạo issue theo mẫu.

## Quy ước format tài liệu

- Mỗi file bắt đầu bằng dòng phiên bản + ngày cập nhật.
- Dùng tiếng Việt; thuật ngữ kỹ thuật giữ nguyên tiếng Anh (booking, slot, venue, court).
- Mọi mã tính năng theo format `ROLE-NN` (CUS-01, OWN-03, ADM-02).
- Mọi thay đổi lớn ghi vào CHANGELOG ở cuối file.

## CHANGELOG

| Ngày | Thay đổi | File ảnh hưởng |
|------|----------|----------------|
| 2026-10-07 | Vẽ lại ERD 3 cấp độ (Conceptual/Logical/Physical) | `04` |
| 2026-10-07 | Bổ sung endpoint còn thiếu cho 3 vai trò (uploads, notifications, favorites, owner reports, admin, catalogs, v.v.) | `11` |
| 2026-10-07 | Đổi thanh toán sang chuyển khoản QR + ảnh chứng minh + Owner duyệt (ADR-006, ADR-010); bỏ webhook/sandbox khỏi MVP | `01` `02` `03` `04` `05` `10` `11` `15` `16` `17` `18` |
| 2026-10-07 | Chọn UUID v7 sinh ở tầng ứng dụng (ADR-011), thay ghi chú "chưa thống nhất" | `04` `10` `18` |
| 2026-10-07 | Thêm bảng `areas` (ADR-009), `auth_tokens`, `owner_applications`, `venue_payment_accounts`, `cancellation_policies`; thêm cột `users.email_verified_at`, `reviews.owner_reply`, `bookings.source/guest_*/created_by/deposit_amount`; `bookings.customer_id` cho phép NULL | `04` |
