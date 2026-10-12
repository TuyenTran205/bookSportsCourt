# 14 – GitHub Workflow

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-12

## Mô hình quản lý dự án

**GitHub Issues + GitHub Projects (board) + Milestones (= Phase)**

### Cột Board
| Cột | Ý nghĩa |
|-----|---------|
| **Backlog** | Đã tạo issue nhưng chưa sẵn sàng làm |
| **Ready** | Đủ điều kiện bắt đầu (xem DoR bên dưới) |
| **In progress** | Đang làm (nhánh đã tạo) |
| **In review** | PR đã mở, đang chờ review |
| **Done** | PR đã merge, issue đã đóng |

### Custom Fields
- **Priority:** P0 / P1 / P2
- **Phase:** 0 – 6
- **Area:** web / api / shared / db / infra / design
- **Estimate:** S (1-2 ngày) / M (3-4 ngày) / L (1 tuần)
- **Assignee:** thành viên phụ trách

## Label chuẩn

> **Nguồn đúng là [`.github/labels.yml`](../.github/labels.yml)** (và `.github/scripts/setup-github.sh` tạo label từ đó). Bảng dưới chỉ để tra cứu nhanh — khi sửa label, sửa ở `labels.yml` rồi cập nhật lại bảng này.

| Label | Ý nghĩa | Màu |
|-------|---------|-----|
| `type:feature` | Tính năng mới | #0075ca |
| `type:bug` | Sửa lỗi | #d73a4a |
| `type:task` | Tác vụ kỹ thuật (setup, config) | #e4e669 |
| `type:docs` | Tài liệu | #cfd3d7 |
| `type:chore` | Dọn dẹp, deps update | #fef2c0 |
| `area:web` | Frontend Next.js | #bfd4f2 |
| `area:api` | Backend NestJS | #d4c5f9 |
| `area:shared` | packages/shared | #f9d0c4 |
| `area:db` | Database, migration | #c3f0ca |
| `area:infra` | CI, Docker, Deploy | #fff3cd |
| `area:design` | Design system, UI | #fce4ec |
| `prio:P0` | Bắt buộc (MVP) | #b60205 |
| `prio:P1` | Nên có | #e4e11a |
| `prio:P2` | Hướng phát triển | #c2e0c6 |
| `phase:0` – `phase:6` | Milestone tương ứng | |
| `status:blocked` | Issue bị chặn bởi issue khác | #f9d0c4 |

> Tên label trong PR template, issue template và bảng này phải **khớp từng ký tự** với `labels.yml`. Gắn label không tồn tại thì GitHub bỏ qua im lặng, khiến PR không được phân loại mà không ai biết.

## Definition of Ready (DoR) – Issue đủ điều kiện làm

- [ ] Có mô tả rõ ràng: người dùng nào, làm gì, tại sao
- [ ] Có acceptance criteria dạng checkbox
- [ ] Đã có mã tính năng (CUS-XX, OWN-XX, ADM-XX) nếu liên quan
- [ ] Đã gắn label đúng (type, area, prio, phase)
- [ ] Không có dependency chưa hoàn thành (hoặc đã ghi rõ dependency)
- [ ] Estimate đã được gán

## Definition of Done (DoD) – Merge được

- [ ] Code đã được review và approve bởi ≥ 1 thành viên khác
- [ ] CI pass hoàn toàn (lint, typecheck, test, build)
- [ ] Unit test đã viết (bắt buộc với booking/giá/phân quyền)
- [ ] OpenAPI cập nhật nếu có thay đổi API
- [ ] Migration có version nếu thay đổi DB
- [ ] Tài liệu liên quan cập nhật trong cùng PR
- [ ] PR UI kèm ảnh chụp 375px và 1440px
- [ ] Không có `any`, `@ts-ignore` không lý do, `console.log` thừa
- [ ] Issue đã được đóng (dùng `Closes #XX` trong PR description)

## Quy trình nhánh

```
main (protected, nhánh phát hành)
  ▲
  │  chỉ merge từ develop khi tới mốc phát hành/demo
  │
develop (protected, nhánh tích hợp – nhánh làm việc mặc định)
  └── feat/42-slot-grid-component       ← Phát triển tính năng
  └── fix/38-refresh-token-rotation     ← Sửa lỗi
  └── docs/15-update-api-contract       ← Cập nhật tài liệu
  └── chore/8-setup-eslint-config       ← Cấu hình
```

**Nhánh làm việc:** mọi nhánh `feat/`, `fix/`, `docs/`, `chore/` đều tách từ **`develop`** và PR ngược về **`develop`**. `main` chỉ nhận merge từ `develop` khi tới mốc phát hành (xem `docs/15-*`).

**Quy tắc đặt tên:** `<type>/<số-issue>-<slug-ngắn>`

**Luồng làm việc:**
```
1. Kéo issue từ Ready → In progress
2. git checkout develop && git pull
   git checkout -b feat/42-slot-grid-component
3. Commit theo Conventional Commits với #42
4. Push và mở PR → develop; Chuyển issue sang In review
5. Review trong 24h; CI pass; resolve comment
6. Squash merge vào develop
7. Issue tự đóng; chuyển sang Done
```

> **Lưu ý:** `ci.yml` trigger trên cả `develop` và `main`, nên PR vào `develop` cũng có CI chạy.

## Branch Protection (develop và main)

Cài đặt trong GitHub repository Settings → Branches, áp dụng cho **cả hai** nhánh:
- [x] Require a pull request before merging
- [x] Require approvals: **1** (tối thiểu)
- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass: `lint`, `typecheck`, `test`, `build`
- [ ] **Từ Phase 5 trở đi:** thêm `e2e` vào danh sách check bắt buộc (job `e2e` trong `ci.yml` đã có sẵn; chỉ bật khi flow đặt sân đã chạy được đầu-cuối. Bật sớm sẽ chặn mọi PR vì chưa có gì để test.)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings
- [x] Restrict force pushes: **Tất cả** (kể cả admin)

> Tên check phải khớp **chính xác** tên job trong `.github/workflows/ci.yml` (`lint`, `typecheck`, `test`, `build` — chữ thường). Đổi tên job mà quên sửa mục này thì branch protection sẽ chặn mọi PR vì check không bao giờ xuất hiện.

**Nghiêm cấm:** Push trực tiếp vào `main` hoặc `develop`. Tự approve PR của mình.

## Quy trình PR

### Kích thước PR
- Khuyến nghị: < 400 dòng thay đổi.
- PR lớn hơn: phải chia nhỏ hoặc giải thích lý do trong description.

### Thời gian review
- Review trong **24 giờ** sau khi mở PR (buổi học ngày hôm sau).
- Nếu blocked → tag người cụ thể và giải thích.

### Checklist reviewer
- [ ] Logic nghiệp vụ đúng và không đặt trong controller/FE
- [ ] Không có security issue (auth bypass, IDOR)
- [ ] Test đầy đủ với business logic quan trọng
- [ ] Không có hardcode style ngoài token
- [ ] Migration đúng format nếu thay đổi DB
- [ ] OpenAPI đã cập nhật nếu thay đổi API

### Thay đổi API → cập nhật trong cùng PR
```
✅ ĐÚNG: 1 PR = code BE + code FE (hoặc client) + cập nhật 11-api-contract.md + OpenAPI
❌ SAI:  2 PR riêng biệt: 1 cho BE, 1 cho FE, tài liệu để sau
```

## Nhịp làm việc (Sprint 1 tuần)

| Thời điểm | Hoạt động |
|-----------|-----------|
| **Đầu tuần (T2)** | Sprint planning: review backlog, chọn issue vào Ready, assign |
| **Giữa tuần (T4-T5)** | Standup ngắn 15 phút: ai làm gì, có bị blocked không |
| **Cuối tuần (T7-CN)** | Sprint review + retrospective; demo nội bộ; update board |

### Báo blocker
- Label `status:blocked` vào issue.
- Comment mô tả đang blocked bởi gì (issue số bao nhiêu, người nào).
- Tag người liên quan trong comment.

## Quy tắc monorepo

### Xung đột merge
- Khi merge nhánh vào `develop` (hoặc `develop` vào `main`) bị conflict: người tạo PR chịu trách nhiệm resolve.
- Ưu tiên rebase thay vì merge commit (để lịch sử sạch hơn).

### Thay đổi packages/shared
- Thay đổi `packages/shared` ảnh hưởng CẢ FE và BE → **phải thông báo nhóm** trước khi merge.
- PR sửa shared phải được review bởi cả người làm FE lẫn BE.
- Sau khi merge → người còn lại cập nhật nhánh của mình ngay.

### Release tag cho demo

| Tag | Mốc | Phase |
|-----|-----|-------|
| v0.1 | Kết thúc Phase 1 (auth + venue + search) | 1 |
| v0.2 | Kết thúc Phase 2 (booking + realtime) | 2 |
| v0.3 | Kết thúc Phase 3 (owner dashboard) | 3 |
| v0.4 | Kết thúc Phase 4 (admin + payment + email) | 4 |
| v0.5 | Kết thúc Phase 5 (test + deploy + hoàn thiện) | 5 |
| v1.0 | Demo cuối kỳ (đóng băng, nộp bài) | – |

> Phase 6 (Mobile) là **tuỳ chọn, làm sau khi nộp bài** (xem [15-team-and-roadmap.md](15-team-and-roadmap.md)) nên **không** có tag trong đồ án.
>
> Tag chỉ đánh trên `main`, sau khi merge từ `develop`. Không tag trên nhánh tính năng.

## Quy tắc dùng AI Agent

1. Agent phải đọc `AGENTS.md` + tài liệu liên quan TRƯỚC khi viết code.
2. Mỗi lần chỉ làm **một issue** duy nhất.
3. Tạo PR nhỏ (< 400 dòng), giải thích rõ trong description.
4. **Không tự thêm dependency** khi chưa ghi vào `18-decision-log.md`.
5. Không tự quyết định design pattern, màu sắc, layout ngoài `07-design-system.md`.
6. Mọi thay đổi DB phải kèm migration file.
7. Không push thẳng vào `develop` hoặc `main` dưới bất kỳ lý do gì.
