# 09 – Quy ước Frontend

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-12

## Cấu trúc thư mục (Feature-based)

```
apps/web/
├── middleware.ts                 # Chặn route theo role TRƯỚC khi render (xem bên dưới)
├── app/                          # Next.js App Router
│   ├── (public)/                 # Route group: không cần auth
│   │   ├── page.tsx              # Trang chủ
│   │   ├── venues/               # Tìm sân
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx   # Chi tiết sân
│   │   └── (auth)/               # Nhóm route xác thực
│   │       ├── login/page.tsx
│   │       ├── register/page.tsx
│   │       ├── forgot-password/page.tsx
│   │       ├── reset-password/page.tsx
│   │       └── verify-email/page.tsx
│   ├── auth/callback/google/page.tsx   # Nhận redirect từ BE, KHÔNG phải route group (phải truy cập được khi chưa có session)
│   ├── (customer)/               # Route group: cần auth customer
│   │   ├── bookings/             # Lịch đặt sân
│   │   ├── favorites/            # Sân yêu thích (CUS-11)
│   │   └── profile/
│   ├── (owner)/                  # Route group: cần auth owner
│   │   └── dashboard/
│   ├── (admin)/                  # Route group: cần auth admin
│   │   └── dashboard/
│   ├── layout.tsx                # Root layout: bọc <Providers>
│   ├── providers.tsx             # QueryClientProvider + SocketProvider + Toaster ("use client")
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn/ui components (đừng sửa trực tiếp)
│   ├── common/                   # Component dùng chung (Header, Footer, ...)
│   └── features/                 # Component theo feature
│       ├── venues/               # VenueCard, VenueGallery, VenueSearch
│       ├── booking/              # SlotGrid, BookingSummary, HoldCountdown
│       ├── owner/                # OwnerTimeline, RevenueChart
│       └── admin/                # UserTable, VenueApprovalCard
├── lib/
│   ├── api/                      # API client (xem "HTTP client" bên dưới)
│   │   ├── client.ts             # fetch wrapper: base URL, auth, parse { data, meta }, chuẩn hoá lỗi
│   │   ├── server.ts             # Biến thể cho Server Component (gắn cookie qua next/headers)
│   │   └── endpoints/            # Typed API functions theo module
│   ├── utils/                    # Helper thuần (date, format, ...)
│   └── hooks/                    # Custom hooks dùng chung
├── store/                        # Zustand (CHỈ state UI cục bộ)
├── types/                        # Type FE-specific (import từ packages/shared trước)
└── messages/                     # next-intl locale files
    └── vi.json
```

### HTTP client: dùng `fetch`, KHÔNG dùng Axios

Dự án dùng **`fetch` gốc của Next.js** (đã được mở rộng sẵn caching/revalidation). **Không** thêm Axios: nó không có trong stack ở [03-architecture.md](03-architecture.md), và mọi thứ cần dùng (interceptor, base URL, parse lỗi) đều làm được bằng một wrapper mỏng.

```typescript
// lib/api/client.ts
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include', // gửi cookie httpOnly
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw await ApiError.fromResponse(res); // đọc { error: { code, message } }
  return res.json() as Promise<T>;
}
```

> Trước đây tài liệu ghi "Axios/fetch instance" (chưa chốt). Chốt là `fetch` — thêm Axios sẽ là một dependency mới cần ADR (xem [18-decision-log.md](18-decision-log.md)).

### Providers (`app/providers.tsx`)

TanStack Query và Socket.IO đều cần một Provider phía client. Gom cả hai vào **một** file `providers.tsx` được bọc ở `app/layout.tsx`, để không phải rải `"use client"` khắp cây component.

```typescript
'use client';
// Bọc: QueryClientProvider (TanStack Query v5) → SocketProvider → Toaster
// SocketProvider CHỈ kết nối khi đã đăng nhập; khách chưa đăng nhập không mở socket
// (xem quy tắc xác thực socket ở 05-booking-and-realtime.md#kênh-channelroom).
```

### `middleware.ts` – chặn route theo role

Middleware chạy ở edge **trước** khi trang render, dùng để chặn sớm. Đây **không** phải lớp bảo vệ thật: nó chỉ đọc cookie để biết role, còn quyền thật do BE kiểm tra ở từng endpoint (xem [06-security-and-permissions.md](06-security-and-permissions.md)). FE chặn route là để UX, BE chặn là để bảo mật.

| Route group | Điều kiện cho qua | Không đủ điều kiện thì |
|-------------|-------------------|------------------------|
| `(public)` | ai cũng vào | – |
| `(customer)` | có session, `role = customer` (hoặc owner/admin cũng đặt sân được) | redirect `/login?next=<path>` |
| `(owner)` | có session, `role = owner` hoặc `admin` | redirect `/login?next=<path>` |
| `(admin)` | có session, `role = admin` | 404 (không phải 403 — không tiết lộ route có tồn tại) |

> `/auth/callback/google` **phải** nằm ngoài mọi route group được bảo vệ: trình duyệt quay về đây từ `accounts.google.com` khi chưa có cookie phiên, nên nếu middleware chặn thì luồng OAuth gãy ngay (cùng lý do với `SameSite=Lax` ở [06-security-and-permissions.md](06-security-and-permissions.md)).

## Server vs Client Component

| Tiêu chí | Server Component | Client Component |
|----------|-----------------|-----------------|
| Data fetching | ✅ Dùng trực tiếp | ❌ Dùng TanStack Query |
| Interactivity (onClick, useState) | ❌ | ✅ |
| Realtime (WebSocket) | ❌ | ✅ |
| SEO critical | ✅ Ưu tiên | ❌ |
| `use client` directive | Không có | Có |

**Quy tắc:** Mặc định là Server Component; thêm `"use client"` chỉ khi cần thiết.

```typescript
// app/venues/page.tsx – Server Component (SEO, data fetching)
export default async function VenuesPage({ searchParams }) {
  const venues = await apiServer.venues.list(searchParams);
  return <VenueList venues={venues} />;
}

// components/features/venues/VenueSearch.tsx – Client Component
"use client";
export function VenueSearch() {
  const [query, setQuery] = useState('');
  // ...
}
```

## Data Fetching

### Rule bắt buộc
1. **FE KHÔNG gọi DB trực tiếp.** Mọi dữ liệu qua `lib/api`.
2. **Mọi mutation** dùng `useMutation` của TanStack Query.
3. **Invalidate cache** sau mutation thành công.

```typescript
// lib/api/endpoints/venues.ts
export const venueApi = {
  list: (params: VenueSearchParams) =>
    apiClient.get<PaginatedResponse<Venue>>('/venues', { params }),
  getBySlug: (slug: string) =>
    apiClient.get<Venue>(`/venues/${slug}`),
};

// Trong component Client
const { data, isLoading, error } = useQuery({
  queryKey: ['venues', params],
  queryFn: () => venueApi.list(params),
  staleTime: 60_000,
});
```

### Loading / Error / Empty state
```typescript
if (isLoading) return <VenueListSkeleton />;
if (error)     return <ErrorState message="Không thể tải danh sách sân" onRetry={refetch} />;

// LƯU Ý: response danh sách có dạng { data: [...], meta: {...} } (xem 11-api-contract.md),
// nên phải là `data.data.length`. Viết `data?.length` là sai kiểu: mảng nằm ở
// `data.data`, còn `data.length` luôn `undefined` → điều kiện luôn đúng và
// màn hình sẽ LUÔN hiện EmptyState dù có dữ liệu.
if (!data?.data.length) return <EmptyState
  icon={<MapPin />}
  title="Không tìm thấy sân"
  description="Thử thay đổi bộ lọc hoặc khu vực tìm kiếm"
  action={<Button onClick={clearFilters}>Xoá bộ lọc</Button>}
/>;
```

> Với `useInfiniteQuery` thì mảng nằm ở `data.pages.flatMap(p => p.data)`. Nên tách một helper `getItems(data)` dùng chung thay vì truy cập thủ công ở mỗi component.

## Form

```typescript
// Dùng React Hook Form + Zod (schema từ packages/shared)
import { BookingHoldSchema } from '@bsc/shared/schemas';

const form = useForm<BookingHoldInput>({
  resolver: zodResolver(BookingHoldSchema),
});
```

## Zustand – CHỈ cho state UI cục bộ

```typescript
// ✅ ĐÚNG: State UI (modal mở/đóng, filter sidebar)
const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
}));

// ❌ SAI: Không lưu server data vào Zustand (dùng TanStack Query)
// Không lưu: user profile, venue list, booking data
```

## Accessibility (WCAG AA)

- Mọi `<img>` có `alt` mô tả đúng.
- Mọi form field có `<label>` liên kết (`htmlFor`).
- Không dùng màu làm thông tin duy nhất (kèm icon hoặc text).
- Focus indicator luôn hiển thị (không dùng `outline: none` trần trụi).
- ARIA labels cho icon-only buttons.

## Responsive

Bộ breakpoint chuẩn của dự án (dùng thống nhất ở mọi tài liệu, PR template và checklist review): **375 / 768 / 1280 / 1440**.

- Thiết kế mobile-first cho flow khách (`sm → md → lg → xl`).
- Thiết kế desktop-first cho dashboard owner/admin (`lg → md → sm`).
- **Kiểm tra ở cả 4 mốc: 375px, 768px, 1280px, 1440px.**
- Ảnh chụp màn hình trong PR chỉ cần ở 2 đầu mút: **375px và 1440px** (4 ảnh cho mỗi PR là quá nặng, mà 2 mốc giữa đã được bộ test responsive tự kiểm).

| Tên | px | Tailwind |
|-----|----|----------|
| Mobile | 375 | (mặc định) |
| Tablet | 768 | `md` |
| Desktop nhỏ | 1280 | `xl` |
| Desktop lớn | 1440 | `2xl` |

## i18n (next-intl)

```typescript
// ❌ SAI – Hard-code chuỗi
<p>Đặt sân thành công!</p>

// ✅ ĐÚNG
const t = useTranslations('booking');
<p>{t('holdSuccess')}</p>

// messages/vi.json
{ "booking": { "holdSuccess": "Giữ chỗ thành công! Hãy chuyển khoản qua mã QR và tải ảnh xác nhận trong 10 phút." } }
```

**Quy tắc:** KHÔNG hard-code bất kỳ chuỗi hiển thị nào trong **code sản phẩm**. Luôn qua `t()`.

> **Ngoại lệ có chủ đích — code mẫu trong tài liệu.** Các ví dụ ở `docs/07`, `docs/08`, `docs/09` viết thẳng tiếng Việt (`"Không thể tải danh sách sân"`, `"Xoá bộ lọc"`…) để dễ đọc. Khi copy vào code thật, **phải** thay bằng `t('...')` và thêm khoá vào `messages/vi.json`. Đây là quy ước của tài liệu, không phải ngoại lệ của code.
>
> Hiện dự án chỉ có **một** locale `vi`. `next-intl` được dựng sẵn để sau này thêm `en` mà không phải sửa component — không phải vì MVP cần đa ngôn ngữ. Vì vậy đừng vì "chỉ có tiếng Việt" mà bỏ qua `t()`.

## Hiệu năng

- Dùng `next/image` cho mọi ảnh venue.
- Lazy load component nặng (`dynamic(() => import(...), { ssr: false })`).
- `staleTime` hợp lý trong TanStack Query (tránh refetch không cần thiết).
- Tránh re-render: dùng `useCallback`, `useMemo` khi cần thiết (không lạm dụng).

## SEO

- Mỗi trang có `generateMetadata()` trả về `title`, `description`.
- Dùng semantic HTML: `<main>`, `<article>`, `<nav>`, `<header>`, `<footer>`.
- Venue detail page có structured data (JSON-LD).
