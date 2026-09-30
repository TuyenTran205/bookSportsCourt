# 09 – Quy ước Frontend

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30

## Cấu trúc thư mục (Feature-based)

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Route group: không cần auth
│   │   ├── page.tsx              # Trang chủ
│   │   ├── venues/               # Tìm sân
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx   # Chi tiết sân
│   ├── (customer)/               # Route group: cần auth customer
│   │   ├── bookings/             # Lịch đặt sân
│   │   └── profile/
│   ├── (owner)/                  # Route group: cần auth owner
│   │   └── dashboard/
│   ├── (admin)/                  # Route group: cần auth admin
│   │   └── dashboard/
│   ├── layout.tsx
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
│   ├── api/                      # API client (sinh từ OpenAPI)
│   │   ├── client.ts             # Axios/fetch instance với interceptors
│   │   └── endpoints/            # Typed API functions theo module
│   ├── utils/                    # Helper thuần (date, format, ...)
│   └── hooks/                    # Custom hooks dùng chung
├── store/                        # Zustand (CHỈ state UI cục bộ)
├── types/                        # Type FE-specific (import từ packages/shared trước)
└── messages/                     # next-intl locale files
    └── vi.json
```

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
if (!data?.length) return <EmptyState
  icon={<MapPin />}
  title="Không tìm thấy sân"
  description="Thử thay đổi bộ lọc hoặc khu vực tìm kiếm"
  action={<Button onClick={clearFilters}>Xoá bộ lọc</Button>}
/>;
```

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

- Thiết kế mobile-first cho flow khách (`sm → md → lg → xl`).
- Thiết kế desktop-first cho dashboard owner/admin (`lg → md → sm`).
- Kiểm tra ở 375px, 768px, 1280px, 1440px.

## i18n (next-intl)

```typescript
// ❌ SAI – Hard-code chuỗi
<p>Đặt sân thành công!</p>

// ✅ ĐÚNG
const t = useTranslations('booking');
<p>{t('holdSuccess')}</p>

// messages/vi.json
{ "booking": { "holdSuccess": "Giữ chỗ thành công! Bạn có 10 phút để thanh toán." } }
```

**Quy tắc:** KHÔNG hard-code bất kỳ chuỗi hiển thị nào. Luôn qua `t()`.

## Hiệu năng

- Dùng `next/image` cho mọi ảnh venue.
- Lazy load component nặng (`dynamic(() => import(...), { ssr: false })`).
- `staleTime` hợp lý trong TanStack Query (tránh refetch không cần thiết).
- Tránh re-render: dùng `useCallback`, `useMemo` khi cần thiết (không lạm dụng).

## SEO

- Mỗi trang có `generateMetadata()` trả về `title`, `description`.
- Dùng semantic HTML: `<main>`, `<article>`, `<nav>`, `<header>`, `<footer>`.
- Venue detail page có structured data (JSON-LD).
