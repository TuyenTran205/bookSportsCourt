#!/usr/bin/env bash
# setup-github.sh – Khởi tạo GitHub repo cho dự án BookSportsCourt
# Yêu cầu: GitHub CLI (gh) đã cài và đã đăng nhập
# Chạy: bash .github/scripts/setup-github.sh
# KHÔNG tự chạy file này; đọc kỹ trước khi thực thi.

set -euo pipefail

REPO="${GITHUB_REPO:-}"  # Ví dụ: "your-org/booksports"

if [ -z "$REPO" ]; then
  echo "Lỗi: Set GITHUB_REPO trước khi chạy. Ví dụ:"
  echo "  GITHUB_REPO=your-org/booksports bash .github/scripts/setup-github.sh"
  exit 1
fi

echo "=== Thiết lập GitHub repo: $REPO ==="

# === 1. Tạo Labels ===
echo ""
echo "--- Tạo labels ---"

create_label() {
  local name="$1" color="$2" description="$3"
  gh label create "$name" --color "$color" --description "$description" --repo "$REPO" \
    --force 2>/dev/null && echo "  ✓ $name" || echo "  ~ $name (bỏ qua)"
}

# Type
create_label "type:feature" "0075ca" "Tính năng mới"
create_label "type:bug"     "d73a4a" "Lỗi cần sửa"
create_label "type:task"    "e4e669" "Tác vụ kỹ thuật"
create_label "type:docs"    "cfd3d7" "Cập nhật tài liệu"
create_label "type:chore"   "fef2c0" "Dọn dẹp, deps"

# Area
create_label "area:web"     "bfd4f2" "Frontend Next.js"
create_label "area:api"     "d4c5f9" "Backend NestJS"
create_label "area:shared"  "f9d0c4" "packages/shared"
create_label "area:db"      "c3f0ca" "Database / Migration"
create_label "area:infra"   "fff3cd" "CI/CD, Docker, Deploy"
create_label "area:design"  "fce4ec" "Design system, UI"

# Priority
create_label "prio:P0"      "b60205" "Bắt buộc (MVP)"
create_label "prio:P1"      "e4e11a" "Nên có"
create_label "prio:P2"      "c2e0c6" "Hướng phát triển"

# Phase
create_label "phase:0"      "ededed" "Phase 0: Setup"
create_label "phase:1"      "e1d5f7" "Phase 1: Auth/Venue"
create_label "phase:2"      "cce5ff" "Phase 2: Booking"
create_label "phase:3"      "d4edda" "Phase 3: Owner"
create_label "phase:4"      "fff3cd" "Phase 4: Admin/Payment"
create_label "phase:5"      "f8d7da" "Phase 5: Finalize"
create_label "phase:6"      "d1ecf1" "Phase 6: Mobile"

# Status
create_label "status:blocked" "f9d0c4" "Issue bị chặn bởi issue khác"

# === 2. Tạo Milestones ===
echo ""
echo "--- Tạo Milestones ---"

create_milestone() {
  local title="$1" description="$2"
  gh api repos/$REPO/milestones \
    --method POST \
    --field title="$title" \
    --field description="$description" \
    --field state="open" \
    2>/dev/null && echo "  ✓ $title" || echo "  ~ $title (đã tồn tại)"
}

create_milestone "phase-0-setup"           "Phase 0: Khởi tạo monorepo, CI, design tokens"
create_milestone "phase-1-auth-venue"      "Phase 1: Auth, Venue/Court CRUD, Tìm kiếm"
create_milestone "phase-2-booking-realtime" "Phase 2: Booking, Hold, EXCLUDE, Realtime"
create_milestone "phase-3-owner"           "Phase 3: Owner Dashboard, OwnerTimeline"
create_milestone "phase-4-admin-payment"   "Phase 4: Admin, VietQR Sandbox, Email"
create_milestone "phase-5-finalize"        "Phase 5: Test, Deploy, Demo, Báo cáo"
create_milestone "phase-6-mobile"          "Phase 6: Mobile (Tuỳ chọn)"

echo ""
echo "=== Hoàn thành! ==="
echo ""
echo "Bước tiếp theo:"
echo "1. Vào repo Settings → Branches → Thêm branch protection cho 'main'"
echo "2. Tạo GitHub Project board với các cột: Backlog/Ready/In progress/In review/Done"
echo "3. Tạo issue đầu tiên: BSC-001 (Khởi tạo monorepo)"
echo "4. Thêm GitHub username thực vào .github/CODEOWNERS"
