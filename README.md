# BookSportsCourt

Hệ thống đặt sân thể thao trực tuyến — đồ án Chuyên đề CNTT (TLU).

Khách tìm sân theo môn/khu vực, xem lưới giờ trống theo thời gian thực, giữ chỗ 10 phút,
thanh toán bằng chuyển khoản QR (chủ sân duyệt tay). Chủ sân quản lý venue/court, giá theo
khung giờ, duyệt đơn; Admin duyệt venue và kiểm duyệt nội dung.

## Công nghệ

| Tầng | Stack |
|------|-------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS (Dark Mode `class`), shadcn/ui, TanStack Query v5, Zustand, `next-intl`, Socket.IO client, MapLibre GL JS + PMTiles, Recharts |
| Backend | NestJS 10, Drizzle ORM, PostgreSQL 16 (`btree_gist`, `pg_trgm`, `unaccent`), Socket.IO (`/ws`), `@nestjs/schedule`, `jose` (JWT cookie `httpOnly`), Argon2id, Sharp, Google OAuth 2.0 (PKCE) |
| Hạ tầng | Neon (DB), Vercel (FE), Render/Railway (BE), Cloudflare R2 (ảnh, PMTiles, font glyphs), Resend / Gmail SMTP (email) |

Monorepo pnpm workspace + Turborepo: `apps/web` (FE), `apps/api` (BE), `packages/shared` (types/schema dùng chung).

## Bắt đầu

```bash
# 1. Cài dependencies
pnpm install

# 2. Tạo file env từ mẫu, rồi điền giá trị thật
cp .env.example .env.local

# 3. Chạy PostgreSQL local (tuỳ chọn, nếu không dùng Neon)
docker compose up -d

# 4. Tạo schema + dữ liệu mẫu
pnpm --filter @bsc/api db:migrate
pnpm --filter @bsc/api db:seed

# 5. Chạy dev (FE + BE song song)
pnpm dev
```

- FE: http://localhost:3000
- BE: http://localhost:3001 — Swagger UI ở `/api/docs` (chỉ dev)

## Lệnh thường dùng

| Lệnh | Việc |
|------|------|
| `pnpm dev` | Chạy FE + BE ở chế độ dev |
| `pnpm build` | Build toàn bộ workspace |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Kiểm tra kiểu |
| `pnpm test` | Unit + integration test |
| `pnpm test:e2e` | E2E Playwright (cần DB + BE + FE đang chạy) |
| `pnpm --filter @bsc/api db:migrate` | Chạy migration |
| `pnpm --filter @bsc/api db:seed` | Nạp dữ liệu mẫu |
| `pnpm --filter @bsc/api db:studio` | Drizzle Studio |
| `docker compose up -d` | PostgreSQL local |

## Tài liệu

Đọc theo thứ tự ở [docs/00-README.md](docs/00-README.md). Các file quan trọng nhất:

| File | Nội dung |
|------|----------|
| [01-product-overview.md](docs/01-product-overview.md) | Tổng quan, vai trò, máy trạng thái booking |
| [04-database-schema.md](docs/04-database-schema.md) | Schema, ràng buộc chống trùng lịch |
| [05-booking-and-realtime.md](docs/05-booking-and-realtime.md) | Vòng đời booking, cron, WebSocket |
| [11-api-contract.md](docs/11-api-contract.md) | Hợp đồng API + sự kiện realtime |
| [implemented-apis.md](docs/implemented-apis.md) | Danh mục 125 route handlers thực tế đã triển khai + `/ws` |
| [demo-accounts.md](docs/demo-accounts.md) | Danh sách tài khoản demo sau khi chạy `db:seed` |
| [12-coding-standards.md](docs/12-coding-standards.md) | Quy ước code, test |
| [13-deployment-and-cost.md](docs/13-deployment-and-cost.md) | Deploy và chi phí |
| [14-github-workflow.md](docs/14-github-workflow.md) | Nhánh, commit, PR |

Quy tắc nền tảng cho người/máy cùng đọc: [AGENTS.md](AGENTS.md).

## Góp ý & báo lỗi

Mở issue theo mẫu có sẵn. Nhánh làm việc tách từ `develop`, PR ngược về `develop`
(xem [docs/14-github-workflow.md](docs/14-github-workflow.md)).
