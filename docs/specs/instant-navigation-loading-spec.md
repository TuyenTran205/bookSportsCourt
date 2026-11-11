# ĐẶC TẢ KỸ THUẬT — PHẢN HỒI ĐIỀU HƯỚNG TỨC THÌ (INSTANT NAVIGATION FEEDBACK)

- **Mã spec:** `SPEC-NAV-001`
- **Phiên bản:** `1.0.0`
- **Tác giả:** Product Architect & UX Specifier (`9router_BA`)
- **Trạng thái:** Approved — sẵn sàng bàn giao `senior-dev`
- **Dự án:** BookSportsCourt (Next.js 14.2 App Router · TanStack Query v5 · NestJS API)
- **Tài liệu liên quan:**
  - `docs/07-design-system.md` (token màu, bo góc, motion)
  - `docs/08-ui-quality-rules.md` (quy tắc Anti-AI Design)
  - `docs/09-frontend-conventions.md` (quy ước App Router + TanStack Query)
  - `docs/specs/loading-states-spec.md` (`SPEC-FE-LOADING-01` — primitive `Spinner`, `PageLoader`, `Skeleton`)

---

## 1. Bối cảnh & vấn đề

### 1.1. Hiện trạng (khảo sát codebase)

| # | Bằng chứng | Hệ quả |
|---|---|---|
| 1 | `apps/web/components/layout/DashboardShell.tsx` — `NavList` chỉ set `aria-current`, không có state pending. | Click tab không có phản hồi nào cho tới khi route mới render xong. Trên mạng 3G hoặc khi API chậm, người dùng tưởng app treo và bấm lại nhiều lần. |
| 2 | `apps/web/components/common/Header.tsx` — link điều hướng trang khách tương tự. | Cùng vấn đề, tệ hơn trên mobile vì drawer chỉ đóng trong `useEffect([pathname])`, tức là **sau** khi route đổi. |
| 3 | 16 file `loading.tsx` đều render `<PageLoader />` toàn khối. | Khi chuyển trang, toàn bộ nội dung bị thay bằng spinner giữa màn hình → nháy trắng, mất ngữ cảnh, layout shift. |
| 4 | `apps/web/lib/hooks/useOwnerBookings.ts`, `useAdminUsers.ts`, `useBookings.ts`… không set `placeholderData`. | Đổi trang phân trang hoặc filter làm `isPending` bật lại → bảng dữ liệu sụp về skeleton rồi mới hiện lại (flash). |
| 5 | `apps/web/lib/hooks/useAuth.ts`, `app/(public)/page.tsx`, `app/(public)/venues/page.tsx` gọi `router.push` trực tiếp. | Điều hướng bằng code không đi qua bất kỳ điểm bắt sự kiện click nào → nếu chỉ xử lý ở `onClick` của Link sẽ bỏ sót. |
| 6 | `apps/web/components/layout/DashboardShell.tsx` có `import { Spinner }` chưa dùng (thay đổi chưa commit). | Dấu vết của một lần thử dở dang; cần dọn dẹp hoặc hoàn thiện theo spec này. |

### 1.2. Nguyên nhân gốc

App Router **không** cung cấp tín hiệu “đang điều hướng” cho client. `loading.tsx` chỉ xuất hiện khi segment đích bắt đầu render, và với các route đã prefetch thì nó gần như không xuất hiện — trong khi dữ liệu TanStack Query vẫn đang tải. Kết quả: khoảng trống phản hồi từ lúc click đến lúc có nội dung, và khi có `loading.tsx` thì phản hồi lại quá thô (spinner toàn khối).

### 1.3. Mục tiêu

1. **Phản hồi ≤ 150ms** sau click: nav item đổi trạng thái, thanh tiến trình mảnh xuất hiện ở mép trên.
2. **Không nháy trắng:** nội dung cũ được giữ (stale-while-revalidate) hoặc thay bằng skeleton **đúng hình dạng** trang đích.
3. **Sẵn sàng cho backend thật:** mọi hành vi đúng khi API mất 300–2000ms, khi lỗi mạng, khi redirect đăng nhập.
4. **Không thêm dependency**, không đổi API, không đổi schema dữ liệu.
5. Tuân thủ tuyệt đối `docs/08-ui-quality-rules.md` (không gradient neon, không emoji, không popup alert, không bo góc lố).

### 1.4. Ngoài phạm vi (Non-goals)

- Không đổi cấu trúc route, không thêm trang mới.
- Không thay đổi `Spinner`, `Skeleton`, `PageLoader` hiện có (đã chuẩn hoá ở `SPEC-FE-LOADING-01`).
- Không xử lý optimistic update cho mutation (đã có ở tầng hook).
- Không thêm service worker / offline cache.

---

## 2. Luồng người dùng

### 2.1. Happy path — chuyển tab trong Dashboard

```
Người dùng bấm "Lịch sân" (/owner/timeline)
  │
  ├─ (0ms)   Link nhận click → store.start(href)
  │           • URL KHÔNG đổi ngay lập tức (App Router xử lý)
  │           • Nav item: icon thay bằng Spinner size="xs", aria-busy="true"
  │           • Thanh tiến trình mount, width 8%
  │
  ├─ (≤150ms) Nav item pending hiển thị rõ; thanh chạy tới ~40%
  │
  ├─ (route commit) pathname đổi → store.complete()
  │           • Thanh nhảy 100% trong 150ms rồi fade 200ms và unmount
  │           • Nav item: bỏ aria-busy, icon trở lại, aria-current="page"
  │
  └─ (dữ liệu) Nếu cache TanStack Query còn tươi (staleTime 30–60s):
                render ngay, không skeleton.
                Nếu chưa có: skeleton đúng hình dạng (loading.tsx / component).
```

### 2.2. Happy path — đổi filter / phân trang (chỉ đổi query string)

1. Người dùng bấm “Trang sau” trong bảng.
2. `placeholderData: keepPreviousData` giữ nguyên dữ liệu trang cũ; bảng **không** sụp về skeleton.
3. Thân bảng giảm nhẹ độ đậm (`opacity-60`) và nhận `aria-busy="true"`; spinner nhỏ cạnh nhãn phân trang.
4. Khi dữ liệu mới về: opacity trở lại 100%, số trang cập nhật, focus giữ nguyên trên nút phân trang.
5. Thanh tiến trình trên cùng **có** chạy nếu thao tác làm đổi URL (push/replace); **không** chạy nếu chỉ đổi state cục bộ.

### 2.3. Luồng ngoại lệ bắt buộc

| Tình huống | Hành vi mong đợi |
|---|---|
| **Bấm lại tab đang mở** | Không start thanh, không đổi state, không gọi router. Nav item giữ `aria-current="page"`. |
| **Bấm đúp / bấm 3 lần liên tiếp** | Store chỉ giữ **một** target (lần bấm cuối). Không xếp hàng, không nhân đôi spinner, không gọi router 2 lần (Link của Next đã dedupe; store phải idempotent). |
| **Chuyển trang A → B → C liên tiếp** | Target đổi sang C; thanh **không** reset về 0 nếu đang hiển thị, chỉ tiếp tục từ % hiện tại (tránh nhấp nháy). |
| **Điều hướng bị hủy do lỗi mạng** | Thanh hoàn tất ở mốc timeout 6s, ẩn đi. `error.tsx` của segment hiển thị lỗi + nút “Thử lại”. Không có spinner treo vĩnh viễn. |
| **Chưa đăng nhập, middleware redirect `/owner/*` → `/login?next=…`** | Pathname đổi → thanh hoàn tất bình thường. Không lộ nội dung trang bảo vệ. |
| **Middleware rewrite sang `not-found` (pathname không đổi)** | Thanh hoàn tất theo timeout 6s; trang 404 hiển thị. Đây là ca duy nhất chấp nhận “chờ hết timeout”. |
| **API trả 401 giữa chừng** | `useAuth` xóa session và `router.replace('/login')` → pathname đổi → thanh hoàn tất. |
| **Offline (navigator.onLine = false) ngay lúc click** | Không start thanh. Hiển thị toast một lần: “Mất kết nối mạng. Kiểm tra lại đường truyền.” Điều hướng để Next xử lý (sẽ vào error boundary). |
| **Route đích đã prefetch nhưng data chậm** | Thanh dừng ở 90% (không bao giờ đầy khi chưa xong), skeleton nội dung hiển thị, hoàn tất khi dữ liệu render. |
| **Người dùng bật `prefers-reduced-motion`** | Thanh vẫn xuất hiện nhưng không animate width (chuyển trạng thái tức thời); spinner dùng hiệu ứng breathing có sẵn trong `globals.css`. |
| **Điều hướng bằng `router.push` trong code** | Phải đi qua `useAppRouter()` để store được kích hoạt; không có ngoại lệ. |

### 2.4. Empty state / Error state

- **Empty:** khi danh sách rỗng, hiển thị `EmptyState` hiện có. Không hiển thị empty state trong lúc `isFetching` (tránh nháy “Chưa có dữ liệu” rồi có dữ liệu).
- **Error:** `ErrorState` với nút “Thử lại” gọi `refetch()`. Thanh tiến trình đã kết thúc trước khi error render.
- **Offline:** toast + error boundary; không có spinner toàn trang.

---

## 3. State machine & hợp đồng thời gian

### 3.1. Trạng thái store

```
idle ──start(href)──▶ pending ──complete()──▶ completing ──(200ms)──▶ idle
  ▲                      │                        │
  └────────cancel()──────┴────────cancel()────────┘
```

| Trạng thái | Ý nghĩa | UI |
|---|---|---|
| `idle` | Không có điều hướng | Không render thanh; không nav item nào `aria-busy` |
| `pending` | Đã bấm, route chưa commit | Thanh hiển thị; item khớp `href` hiện spinner |
| `completing` | Route đã commit | Thanh 100%, fade 200ms; item trở lại bình thường |

### 3.2. Hằng số thời gian (bắt buộc, không tự ý đổi)

| Hằng số | Giá trị | Lý do |
|---|---|---|
| `SHOW_DELAY_MS` | `120` | Không hiện thanh cho điều hướng tức thời (<120ms) — tránh nhấp nháy. |
| `MIN_VISIBLE_MS` | `300` | Nếu thanh đã hiện, giữ tối thiểu 300ms để không “chớp”. |
| `TRICKLE_INTERVAL_MS` | `200` | Nhịp tăng tiến trình. |
| `TRICKLE_STEP` | `+ (90 - current) * 0.12` | Tiệm cận 90%, không bao giờ vượt 90% khi pending. |
| `COMPLETE_MS` | `150` | Thời gian chạy 90% → 100%. |
| `FADE_MS` | `200` | Thời gian mờ dần và unmount. |
| `HARD_TIMEOUT_MS` | `6000` | Chốt an toàn chống treo thanh. |
| `SLOW_HINT_MS` | `800` | Sau mốc này, vùng `role="status"` đổi sang thông báo “Kết nối chậm…”. |
| `PREFETCH_HOVER_MS` | `80` | Hover/focus đủ lâu mới prefetch (tránh quét chuột ngang sidebar). |

### 3.3. Quy tắc hiển thị thanh

- Vị trí: `fixed top-0 left-0 right-0`, `z-index` trên Header (Header dùng `z-40` → thanh dùng `z-[60]`).
- Kích thước: cao **2px** (`h-0.5`), **không** bo góc, **không** shadow, **không** gradient.
- Màu: `bg-primary-600` (`#16a34a`). Trên nền trắng đạt tương phản ~3.3:1 — thoả WCAG 1.4.11 cho thành phần UI không phải chữ.
- Khi `prefers-reduced-motion: reduce`: dùng `motion-reduce:transition-none`, thanh hiện/ẩn tức thời.
- Không dùng `role="progressbar"` (đây là chỉ báo không xác định, không có giá trị thực). Thanh là `aria-hidden="true"`; thông tin cho screen reader đi qua live region riêng.

---

## 4. Validation & Data Schema

### 4.1. Kiểu dữ liệu

```ts
// apps/web/lib/navigation/navigation-store.ts
export type NavigationPhase = 'idle' | 'pending' | 'completing';

export interface NavigationSnapshot {
  phase: NavigationPhase;
  /** pathname + search của đích; null khi idle */
  target: string | null;
  /** 0–100, chỉ dùng để vẽ thanh */
  progress: number;
  /** thời điểm bắt đầu, ms epoch; null khi idle */
  startedAt: number | null;
}

export const INITIAL_SNAPSHOT: NavigationSnapshot = {
  phase: 'idle',
  target: null,
  progress: 0,
  startedAt: null,
};
```

```ts
// apps/web/lib/navigation/navigate.ts
export type NavigationKind = 'internal' | 'external' | 'hash' | 'same-route' | 'download';

export interface ClassifiedTarget {
  kind: NavigationKind;
  /** pathname + search đã chuẩn hoá; null với external/download */
  href: string | null;
}
```

### 4.2. Bảng quyết định phân loại link (`classifyNavigation`)

Hàm thuần, không phụ thuộc React, nhận `(href, { pathname, search })` và trả `ClassifiedTarget`. Đây là **hợp đồng kiểm thử chính**.

| # | Điều kiện | `kind` | Hành vi |
|---|---|---|---|
| R1 | `href` rỗng hoặc chỉ có khoảng trắng | `same-route` | Bỏ qua, không start |
| R2 | Bắt đầu bằng `#` | `hash` | Bỏ qua; để trình duyệt cuộn nội bộ |
| R3 | Bắt đầu bằng `mailto:`, `tel:`, `javascript:`, `data:` | `external` | Bỏ qua tuyệt đối (chặn XSS) |
| R4 | Có `download` attribute | `download` | Bỏ qua |
| R5 | `target` khác `_self` (bao gồm `_blank`) | `external` | Bỏ qua |
| R6 | Khác origin với `window.location.origin` | `external` | Bỏ qua |
| R7 | `pathname + search` trùng hiện tại (sau chuẩn hoá) | `same-route` | Bỏ qua |
| R8 | Còn lại | `internal` | `start(href)` |

**Chuẩn hoá trước khi so sánh (R7):**

1. Resolve bằng `new URL(href, window.location.href)`.
2. Bỏ trailing slash, trừ khi path là `/`.
3. Giữ nguyên thứ tự query param như URL đích (không sort) để khớp với `useSearchParams().toString()`.
4. `trim()` toàn bộ khoảng trắng đầu/cuối trước khi parse.
5. So sánh **case-sensitive** với `pathname` (route Next.js phân biệt hoa thường).

### 4.3. Trạng thái pending của nav item

| Điều kiện | Kết quả |
|---|---|
| `snapshot.phase !== 'idle'` **và** `snapshot.target === itemHref` | Item đó pending: thay icon bằng `<Spinner size="xs" />`, set `aria-busy="true"`, giữ nguyên label và `aria-current` (nếu có). |
| `snapshot.phase !== 'idle'` nhưng target khác | Item giữ nguyên trạng thái thường. |
| `phase === 'idle'` | Không có `aria-busy`; icon gốc. |

Không dùng `pointer-events-none` cho item đang pending — người dùng vẫn có thể đổi ý sang tab khác.

### 4.4. Chuỗi hiển thị (i18n, bắt buộc dùng key có sẵn cấu trúc)

Thêm vào `apps/web/messages/vi.json`:

| Key | Giá trị | Dùng ở |
|---|---|---|
| `shell.navigating` | `Đang chuyển trang…` | Live region khi pending (im lặng trong 800ms đầu). |
| `shell.navigatingSlow` | `Kết nối chậm, đang tải…` | Live region sau `SLOW_HINT_MS`. |
| `shell.navigationComplete` | `Đã chuyển trang` | Live region sau khi hoàn tất (đọc 1 lần, xoá sau 1s). |
| `errors.networkOffline` | `Mất kết nối mạng. Kiểm tra lại đường truyền.` | Toast khi offline lúc click. |

Quy tắc chữ: câu ngắn, không emoji, không dấu chấm than, không viết hoa toàn bộ.

---

## 5. Edge cases & Security

### 5.1. Edge cases

| ID | Ca | Xử lý |
|---|---|---|
| E1 | Bấm đúp cùng một link | `start()` idempotent theo `target`; nếu `target` trùng và đang pending → không làm gì. |
| E2 | Bấm 2 tab khác nhau trong 100ms | Target = lần cuối; timer trickle **không** reset; nav item cũ mất spinner ngay. |
| E3 | Chuyển trang khi đang `completing` | `start()` chuyển về `pending`, progress giữ nguyên 100% → đặt lại 8% nếu thanh đã unmount. |
| E4 | Component unmount giữa chừng | `cancel()` dọn mọi `setTimeout`/`setInterval`; không setState sau unmount. |
| E5 | `router.push` ném lỗi đồng bộ | Bọc try/catch trong `useAppRouter`; gọi `cancel()` để thanh không treo. |
| E6 | Middleware rewrite (pathname không đổi) | `HARD_TIMEOUT_MS` kết thúc thanh. Ghi chú rõ trong code. |
| E7 | Điều hướng tới cùng pathname nhưng khác query (filter) | Là `internal` → thanh chạy; hoàn tất khi `useSearchParams()` đổi. |
| E8 | `<Link>` có `onClick` gọi `preventDefault()` (ví dụ mở modal) | Listener click kiểm tra `event.defaultPrevented` **sau** khi handler React chạy → không start. Dùng listener ở pha bubble trên `document` (React 18 gắn handler tại root container, chạy trước listener của `document`). |
| E9 | Click bằng chuột giữa / Ctrl+Click / Shift+Click / Alt+Click | `event.button !== 0` hoặc có modifier → bỏ qua. |
| E10 | Link trong vùng `overflow` đang cuộn (kéo để cuộn) | Chỉ bắt `click`, không bắt `pointerdown`; trình duyệt tự hủy click khi kéo. |
| E11 | Điều hướng do Back/Forward | `popstate` → start với `target = pathname + search` hiện tại sau khi đổi (đọc trong `requestAnimationFrame`), rồi complete khi pathname đổi. Đơn giản hoá: bỏ qua `popstate`, để `loading.tsx` lo — **quyết định: bỏ qua**, ghi rõ trong code. |
| E12 | Trang đích render lỗi (throw) | `error.tsx` bắt; thanh đã complete theo pathname. |
| E13 | Người dùng đổi tab trình duyệt giữa chừng | Timer vẫn chạy; khi quay lại, thanh đã ẩn nếu quá timeout. Không cần xử lý đặc biệt. |
| E14 | Nhiều instance `NavigationProgress` (nếu layout lồng nhau) | Chỉ mount **một** ở root layout; component không tự mount ở layout con. |
| E15 | SSR/hydration | Store là module singleton, khởi tạo `INITIAL_SNAPSHOT`; mọi đọc `window` nằm trong event handler hoặc `useEffect`, không chạy lúc render server. |

### 5.2. Security

| Nguy cơ | Biện pháp |
|---|---|
| XSS qua `href` do người dùng nhập (ô tìm kiếm tạo URL) | `href` luôn được tạo bằng `URLSearchParams` + `encodeURIComponent`; classifier chặn `javascript:`/`data:`; không bao giờ `dangerouslySetInnerHTML`. |
| Rò rỉ token/query nhạy cảm qua log | Không log URL đầy đủ. Chỉ log `pathname` ở môi trường dev, không log query string. |
| Lộ thông tin route qua DOM | Thanh tiến trình `aria-hidden`, không chứa text. Live region chỉ đọc chuỗi tĩnh từ i18n. |
| DoS phía client do timer | Tối đa 1 interval + 3 timeout sống cùng lúc; luôn clear trong `cancel()` và `complete()`. |
| Bỏ qua kiểm soát truy cập | Thanh tiến trình **không** thay thế middleware. Không ẩn/hiện link dựa trên suy đoán phía client ngoài `role` đã có. |
| Memory leak khi điều hướng nhanh | Store dùng một object duy nhất, không tạo closure mới cho mỗi lần start ngoài timer được clear. |

### 5.3. Accessibility

- Nav item pending: `aria-busy="true"` trên chính `<a>`/`<Link>`, **không** đổi accessible name (label giữ nguyên).
- Live region: `<p role="status" aria-live="polite" className="sr-only">` — cập nhật sau `SLOW_HINT_MS` để không làm phiền khi điều hướng nhanh; xoá nội dung 1s sau khi hoàn tất.
- Không tự động chuyển focus. App Router đã xử lý scroll; không can thiệp.
- Focus ring: `focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white` — không bao giờ `outline-none` đơn thuần.
- Touch target nav item mobile: tối thiểu `44×44px` (dùng `h-11` ở drawer mobile).
- Spinner trong nav item có `label=""` (decorative) để không tạo thêm live region lồng nhau.

---

## 6. Kiến trúc file & component

### 6.1. File tạo mới

| Đường dẫn | Nội dung | Ước lượng |
|---|---|---|
| `apps/web/lib/navigation/navigation-store.ts` | Store ngoài React (`useSyncExternalStore`), API `start/complete/cancel/getSnapshot/subscribe`, toàn bộ timer. | ~140 dòng |
| `apps/web/lib/navigation/navigate.ts` | `classifyNavigation()`, `useAppRouter()` (bọc `push/replace/refresh`), listener click toàn cục `useNavigationListener()`. | ~110 dòng |
| `apps/web/lib/navigation/constants.ts` | Các hằng số mục 3.2, export `NAV_TIMING`. | ~15 dòng |
| `apps/web/components/layout/NavigationProgress.tsx` | Thanh 2px + live region; subscribe store; không nhận prop bắt buộc. | ~90 dòng |
| `apps/web/components/ui/page-skeleton.tsx` | `PageSkeleton` với 4 biến thể `dashboard`, `list`, `detail`, `form` — ghép từ `Skeleton` có sẵn. | ~120 dòng |
| `apps/web/lib/navigation/navigation-store.test.ts` | Unit test store. | — |
| `apps/web/lib/navigation/navigate.test.ts` | Unit test classifier + wrapper router. | — |
| `apps/web/components/layout/NavigationProgress.test.tsx` | Widget test thanh tiến trình. | — |
| `apps/web/components/ui/page-skeleton.test.tsx` | Widget test skeleton. | — |

### 6.2. File sửa

| Đường dẫn | Thay đổi |
|---|---|
| `apps/web/app/layout.tsx` | Mount `<NavigationProgress />` trong `<body>`, trước `<SiteChrome>`, bọc trong `<Suspense fallback={null}>` (vì dùng `useSearchParams`). |
| `apps/web/components/layout/DashboardShell.tsx` | `NavList`: đọc `useNavigation()`; item khớp target → `<Spinner size="xs" variant="current" label="" />` thay `<Icon>`, thêm `aria-busy`; giữ nguyên `h-10`, `aria-current`. Xoá `import { Spinner }` thừa nếu không dùng, hoặc dùng đúng như trên. |
| `apps/web/components/common/Header.tsx` | Link desktop + mobile: pending → spinner nhỏ bên phải label + `aria-busy`. Drawer mobile: gọi `onNavigate` (đóng drawer) ngay trong `onClick`, không chờ `pathname`. |
| `apps/web/lib/hooks/useAuth.ts` | Thay `useRouter()` bằng `useAppRouter()`. |
| `apps/web/app/(public)/page.tsx` | Thay `router.push` tìm kiếm bằng `useAppRouter().push`. |
| `apps/web/app/(public)/venues/page.tsx` | Tương tự nếu có `router.push`/`replace`. |
| `apps/web/lib/hooks/useOwnerBookings.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/lib/hooks/useOwnerPayments.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/lib/hooks/useOwnerReviews.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/lib/hooks/useBookings.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/lib/hooks/useAdminUsers.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/lib/hooks/useAdminBookings.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/lib/hooks/useAdminVenues.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/lib/hooks/useAdminOwnerApplications.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/lib/hooks/useAdminAuditLogs.ts` | `placeholderData: keepPreviousData`. |
| `apps/web/components/ui/data-table.tsx` | Thêm prop tuỳ chọn `isFetching?: boolean`: `<table aria-busy>` + `<tbody className="transition-opacity duration-150 data-[fetching=true]:opacity-60">`; spinner nhỏ ở cụm phân trang. |
| `apps/web/messages/vi.json` | Thêm 4 key ở mục 4.4. |
| 14 file `loading.tsx` (trừ 2 file OAuth) | Thay `<PageLoader />` bằng `<PageSkeleton variant="…" />` theo bảng 6.3. |

### 6.3. Ánh xạ skeleton cho `loading.tsx`

| Route | Variant |
|---|---|
| `app/(owner)/loading.tsx`, `app/(owner)/owner/loading.tsx`, `app/(owner)/dashboard/loading.tsx` | `dashboard` |
| `app/(admin)/loading.tsx`, `app/(admin)/admin/loading.tsx` | `dashboard` |
| `app/(customer)/bookings/loading.tsx`, `app/(customer)/favorites/loading.tsx` | `list` |
| `app/(customer)/bookings/[id]/loading.tsx` | `detail` |
| `app/(customer)/profile/loading.tsx` | `form` |
| `app/(public)/loading.tsx`, `app/(public)/venues/loading.tsx` | `list` |
| `app/(public)/venues/[slug]/loading.tsx` | `detail` |
| `app/(public)/(auth)/loading.tsx` | `form` |
| `app/auth/callback/google/loading.tsx`, `app/loading.tsx` | **Giữ `PageLoader`** (lần tải đầu tiên, chưa có layout) |

`PageSkeleton` phải tái sử dụng `Skeleton` hiện có, dùng `rounded-md` cho khối và `rounded-card` cho card, màu `bg-neutral-100` — không gradient, không shimmer màu.

### 6.4. Hợp đồng API nội bộ

```ts
// navigation-store.ts
export function startNavigation(href: string): void;
export function completeNavigation(): void;
export function cancelNavigation(): void;
export function subscribe(listener: () => void): () => void;
export function getSnapshot(): NavigationSnapshot;

// navigate.ts
export function classifyNavigation(
  href: string | null,
  opts: { pathname: string; search: string; origin: string; download?: boolean; target?: string },
): ClassifiedTarget;

export function useAppRouter(): {
  push(href: string): void;
  replace(href: string): void;
  refresh(): void;
};

export function useNavigation(): NavigationSnapshot;
```

### 6.5. Cơ chế bắt sự kiện

- **Click link:** một listener duy nhất trên `document`, pha **bubble**, mount trong `NavigationProgress` qua `useEffect`.
  - Dùng `event.target.closest('a[href]')`.
  - Bỏ qua nếu `event.defaultPrevented`, `button !== 0`, có modifier, `target` khác `_self`, có `download`.
  - Phân loại bằng `classifyNavigation`; nếu `internal` → `startNavigation(href)`.
- **Hoàn tất:** `useEffect` theo dõi `usePathname()` + `useSearchParams().toString()`; khi cặp giá trị đổi so với lúc start → `completeNavigation()`.
- **Điều hướng lập trình:** `useAppRouter` gọi `startNavigation(href)` trước khi gọi router gốc.
- **Cleanup:** listener và mọi timer được gỡ trong `useEffect` cleanup.

---

## 7. Tiêu chuẩn Anti-AI Design

### 7.1. Danh sách cấm (áp dụng cho toàn bộ diff)

- Cấm gradient neon tím/hồng/xanh, `bg-gradient-to-r`, glow, `blur-*` phát sáng.
- Cấm `rounded-3xl`, `rounded-full` cho thanh tiến trình, card, nút.
- Cấm emoji trong UI, label, toast (`🚀`, `✨`, `⏳`, `🔄`).
- Cấm `alert()`, `confirm()`, `prompt()`, popup trình duyệt.
- Cấm overlay trắng mờ toàn màn hình khi chuyển trang.
- Cấm spinner toàn khối cho route đã biết hình dạng (trừ `app/loading.tsx` và OAuth callback).
- Cấm `animate-pulse` trên cả trang; chỉ dùng cho `Skeleton`.
- Cấm đổi kích thước nav item khi pending (giữ đúng `h-10` desktop, `h-11` mobile).
- Cấm dùng màu ngoài token Tailwind đã map (`primary`, `neutral`, `success`, `danger`, `warning`).

### 7.2. 6 trạng thái của Navigation Item

| Trạng thái | Class / thuộc tính | Ghi chú |
|---|---|---|
| **Default** | `text-neutral-600`, icon `text-neutral-500` | Nền trong suốt. |
| **Hover** | `hover:bg-neutral-100 hover:text-neutral-900`, `transition-colors duration-150` | Không scale, không shadow. |
| **Focus** | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2` | Không bỏ outline mà không thay thế. |
| **Loading (pending)** | `aria-busy="true"`, icon → `<Spinner size="xs" variant="current" label="" />`, chữ giữ nguyên | Không đổi nền, không đổi chiều cao, CLS = 0. |
| **Active** | `bg-primary-50 text-primary-700`, `aria-current="page"` | Vẫn giữ khi pending nếu là trang hiện tại (chỉ xảy ra khi target trùng pathname — đã bị R7 chặn). |
| **Disabled** | `opacity-50 pointer-events-none`, `aria-disabled="true"` | Chỉ dùng cho mục không có quyền; **không** dùng cho pending. |

> `Validation Error` và `Success` không áp dụng cho navigation chrome (không có input). Chúng vẫn bắt buộc đủ 6 trạng thái ở form/button theo `docs/08` — spec này không thay đổi quy định đó.

### 7.3. Token sử dụng

| Token | Giá trị | Dùng ở |
|---|---|---|
| `primary-600` | `#16a34a` | Thanh tiến trình, ring focus, spinner variant `current` kế thừa màu chữ |
| `primary-50` / `primary-700` | — | Nền/chữ item active |
| `neutral-100` / `neutral-200` | — | Hover nền, viền skeleton |
| `neutral-600` / `neutral-900` | — | Chữ mặc định / hover |
| `rounded-btn` | 8px | Nav item |
| `rounded-card` | 12px | Card trong skeleton |
| `duration-150` / `duration-200` | 150/200ms | Hover / thanh tiến trình |

### 7.4. Motion

| Hiệu ứng | Thời lượng | Easing |
|---|---|---|
| Hover nav | 150ms | `ease-out` |
| Thanh tiến trình tăng | 200ms | `ease-out` |
| Hoàn tất thanh | 150ms | `ease-out` |
| Fade thanh | 200ms | `linear` |
| `prefers-reduced-motion` | 0ms | tắt transition |

---

## 8. Test Matrix (bắt buộc cho `auto-tester`)

### 8.1. Unit test — `navigation-store.test.ts`

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| `UT-NAV-01` | `startNavigation('/owner/timeline')` từ idle | `phase='pending'`, `target` đúng, `progress=8`, `startedAt>0` |
| `UT-NAV-02` | Gọi `startNavigation` 2 lần cùng target | Chỉ 1 lần set state; `startedAt` không đổi |
| `UT-NAV-03` | Gọi `startNavigation` với target khác khi pending | `target` = lần cuối; `progress` không reset về 0 |
| `UT-NAV-04` | `completeNavigation()` | `phase='completing'`, `progress=100` |
| `UT-NAV-05` | `complete` rồi chờ `FADE_MS` | `phase='idle'`, `target=null`, `progress=0` |
| `UT-NAV-06` | `cancelNavigation()` khi pending | `idle`; mọi timer đã clear (spy `clearInterval`/`clearTimeout`) |
| `UT-NAV-07` | Không `complete`, chờ `HARD_TIMEOUT_MS` | Tự về `idle`, không treo |
| `UT-NAV-08` | `progress` sau 10 tick | Luôn `≤ 90` khi pending, tăng đơn điệu |
| `UT-NAV-09` | `subscribe`/`unsubscribe` | Listener được gọi đúng số lần; unsubscribe không còn gọi |
| `UT-NAV-10` | `startNavigation` khi `phase='completing'` | Quay lại `pending` với target mới, `progress` khởi động lại an toàn |

### 8.2. Unit test — `navigate.test.ts` (classifier)

| ID | Input | Kỳ vọng |
|---|---|---|
| `UT-CLS-01` | `'/owner/timeline'` | `internal` |
| `UT-CLS-02` | `'https://bsc.vn/venues'` khác origin | `external` |
| `UT-CLS-03` | `'#section'` | `hash` |
| `UT-CLS-04` | `'javascript:alert(1)'` | `external` (chặn) |
| `UT-CLS-05` | `'mailto:a@b.c'` | `external` |
| `UT-CLS-06` | Cùng pathname + search hiện tại | `same-route` |
| `UT-CLS-07` | Cùng pathname, khác `?page=2` | `internal` |
| `UT-CLS-08` | `href` có khoảng trắng đầu/cuối | Trim rồi phân loại đúng |
| `UT-CLS-09` | `target="_blank"` | `external` |
| `UT-CLS-10` | `download=true` | `download` |
| `UT-CLS-11` | `'/venues/'` với pathname hiện tại `/venues` | `same-route` (bỏ trailing slash) |
| `UT-CLS-12` | `useAppRouter().push` | `startNavigation` được gọi **trước** router gốc |

### 8.3. Widget test

| ID | File | Kịch bản | Kỳ vọng |
|---|---|---|---|
| `WT-NAV-01` | `NavigationProgress.test.tsx` | Idle | Không render thanh; không có `aria-busy` |
| `WT-NAV-02` | `NavigationProgress.test.tsx` | `start` + 150ms | Thanh xuất hiện, `aria-hidden="true"`, `height: 2px`, `bg-primary-600` |
| `WT-NAV-03` | `NavigationProgress.test.tsx` | `start` rồi `complete` | Thanh đạt 100% rồi unmount sau `FADE_MS` |
| `WT-NAV-04` | `NavigationProgress.test.tsx` | `start` rồi chờ `SLOW_HINT_MS` | Live region đổi sang `shell.navigatingSlow` |
| `WT-NAV-05` | `NavigationProgress.test.tsx` | `complete` trước `SLOW_HINT_MS` | Live region không đọc `navigatingSlow` |
| `WT-NAV-06` | `DashboardShell.test.tsx` | Click nav item | Item có `aria-busy="true"` và spinner; item khác không có |
| `WT-NAV-07` | `DashboardShell.test.tsx` | Pathname đổi sang target | `aria-busy` bị gỡ, icon gốc trở lại, item có `aria-current="page"` |
| `WT-NAV-08` | `DashboardShell.test.tsx` | Click item đang active | Không start, không `aria-busy` |
| `WT-NAV-09` | `DashboardShell.test.tsx` | Click nav item khi sidebar collapsed | Spinner vẫn render, label `sr-only`, kích thước item không đổi |
| `WT-NAV-10` | `DashboardShell.test.tsx` | Click trong drawer mobile | Drawer đóng ngay (callback `onNavigate` gọi đồng bộ) |
| `WT-NAV-11` | `Header.test.tsx` | Click nav desktop | `aria-busy` + spinner; drawer mobile đóng ngay |
| `WT-NAV-12` | `page-skeleton.test.tsx` | Render 4 variant | Không có text nội dung giả; số khối đúng đặc tả; không gradient |
| `WT-NAV-13` | `data-table.test.tsx` | `isFetching=true` | `<table aria-busy="true">`, tbody `opacity-60`, vẫn render đủ dòng cũ |

### 8.4. Integration test

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| `IT-NAV-01` | Click link sidebar → pathname đổi (mock `next/navigation`) | Thanh xuất hiện rồi biến mất; item trở lại bình thường |
| `IT-NAV-02` | Click link có `onClick={e => e.preventDefault()}` | Không có thanh, không `aria-busy` |
| `IT-NAV-03` | `router.push` từ `useAppRouter` | Store chuyển pending; thanh chạy |
| `IT-NAV-04` | Đổi `page` trong `OwnerBookingsScreen` | Bảng giữ dữ liệu cũ (không skeleton), `aria-busy` bật, opacity 60% |
| `IT-NAV-05` | Điều hướng khi `navigator.onLine=false` | Không start; toast offline hiển thị 1 lần |
| `IT-NAV-06` | `prefers-reduced-motion: reduce` | Không có class transition trên thanh; vẫn hiện/ẩn đúng |
| `IT-NAV-07` | Route đích throw error | `error.tsx` render; thanh đã kết thúc; không spinner treo |
| `IT-NAV-08` | `loading.tsx` của `/owner` render | Là `PageSkeleton variant="dashboard"`, không phải `PageLoader` |

### 8.5. E2E (Playwright — nếu pipeline bật)

| ID | Kịch bản |
|---|---|
| `E2E-NAV-01` | Login owner → click “Lịch sân” → assert thanh tiến trình xuất hiện trong 150ms và biến mất sau khi trang render |
| `E2E-NAV-02` | Click liên tiếp 3 tab trong 300ms → không có request trùng, không treo thanh, kết thúc ở tab cuối |
| `E2E-NAV-03` | Chặn API `/api/owner/timeline` (delay 2s) → thanh dừng ở ≤90%, skeleton hiển thị, không có màn hình trắng |

### 8.6. Cổng chất lượng

- `pnpm typecheck` — 0 lỗi.
- `pnpm lint` — 0 warning mới.
- `pnpm test` — 100% test trên pass.
- `pnpm build` — không cảnh báo `useSearchParams` ngoài Suspense.
- Không tăng bundle quá **3KB gzip** (kiểm bằng `next build` output).

---

## 9. Tiêu chí nghiệm thu (Acceptance Criteria)

- [ ] **AC-1:** Trong vòng 150ms sau click, nav item đích hiển thị `Spinner size="xs"` và `aria-busy="true"`; mọi item khác không đổi.
- [ ] **AC-2:** Thanh tiến trình 2px màu `primary-600` xuất hiện ở mép trên, không bo góc, không shadow, không gradient.
- [ ] **AC-3:** Khi pathname đổi, thanh đạt 100% rồi biến mất trong ≤350ms; nav item trở lại icon gốc và nhận `aria-current="page"`.
- [ ] **AC-4:** Không còn màn hình trắng khi chuyển trang: 14 `loading.tsx` dùng `PageSkeleton` đúng variant, chỉ `app/loading.tsx` và OAuth callback giữ `PageLoader`.
- [ ] **AC-5:** Đổi trang phân trang/filter không làm bảng sụp về skeleton (kiểm trên 9 hook danh sách đã liệt kê).
- [ ] **AC-6:** Bấm lại tab hiện tại, Ctrl+Click, chuột giữa, link ngoài, link `#hash`, link `javascript:` đều **không** kích hoạt thanh.
- [ ] **AC-7:** Điều hướng lập trình (`useAuth`, tìm kiếm trang chủ, `/venues`) đều kích hoạt thanh qua `useAppRouter`.
- [ ] **AC-8:** Drawer mobile đóng ngay khi click, không chờ route commit.
- [ ] **AC-9:** Không có gradient neon, emoji, `rounded-3xl`, `alert()`, overlay trắng trong diff.
- [ ] **AC-10:** Không thêm dependency; bundle delta ≤ 3KB gzip; toàn bộ test mục 8 pass.

---

## 10. Thứ tự triển khai đề xuất

1. `constants.ts` + `navigation-store.ts` + unit test (độc lập, không cần UI).
2. `navigate.ts` (classifier + `useAppRouter`) + unit test.
3. `NavigationProgress.tsx` + mount ở root layout + widget test.
4. `DashboardShell.tsx` và `Header.tsx` (pending state, đóng drawer ngay).
5. Thay `router.push` ở `useAuth`, trang chủ, `/venues`.
6. `PageSkeleton` + cập nhật 14 `loading.tsx`.
7. `placeholderData` cho 9 hook danh sách + `data-table` `isFetching`.
8. i18n keys + rà soát Anti-AI + chạy cổng chất lượng.

---

## 11. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| `useSearchParams` gây lỗi build ngoài Suspense | Bọc `<Suspense fallback={null}>` quanh `NavigationProgress` ở root layout; kiểm bằng `pnpm build`. |
| Listener click bắt nhầm link trong modal/dropdown | Kiểm tra `event.defaultPrevented` sau handler React; tôn trọng `data-no-progress` nếu cần opt-out. |
| Thanh treo khi middleware rewrite | Timeout cứng 6s; ghi chú trong code. |
| Prefetch gây tải API thừa | Chỉ prefetch sau hover/focus 80ms, dùng đúng `queryKey` của hook hiện có, không prefetch khi `navigator.connection.saveData`. |
| Skeleton không khớp layout thật gây nháy lần hai | `PageSkeleton` dùng cùng grid/gap/kích thước với màn hình thật; đối chiếu từng route khi review. |
