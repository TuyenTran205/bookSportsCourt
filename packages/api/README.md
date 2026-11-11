# @bsc/api — Backend (chưa triển khai)

Package này tồn tại để giữ đúng cấu trúc monorepo đã chốt ở **ADR-007** và để
`.github/workflows/ci.yml` chạy được (`pnpm --filter @bsc/api db:migrate` /
`db:seed`) trước khi backend có mặt.

## Trạng thái

Hiện là **stub**: mọi script in thông báo rồi thoát 0. Không có source, không có
dependency.

## Khi bắt đầu làm backend

1. Đọc `docs/10-backend-conventions.md` và `docs/03-architecture.md`.
2. Dựng NestJS + Drizzle theo `docs/04-database-schema.md`.
3. Thay các script `db:migrate` / `db:seed` bằng lệnh Drizzle thật.
4. Dùng lại type & Zod schema từ `@bsc/shared` — **không** định nghĩa lại enum
   hay shape response ở đây, tránh lệch với frontend.

> Giai đoạn hiện tại, frontend chạy hoàn toàn bằng MSW
> (`apps/web/mocks/`), không cần package này.
