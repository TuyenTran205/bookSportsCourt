# ĐẶC TẢ KỸ THUẬT: HOÀN THIỆN FRONTEND BATCH 1 (P0 CHẶN NGHIỆM THU + SỬA TEST ĐỎ)

- **Mã tài liệu:** `SPEC-FE-BATCH1-01`
- **Tác giả:** Product Architect & UX Specifier (`ba-spec` - 9router_BA)
- **Dự án:** BookSportsCourt (Sàn thương mại điện tử đặt sân thể thao đa người dùng)
- **Nền tảng mục tiêu:** Web Client (`apps/web` - Next.js 14 App Router, TypeScript, Tailwind CSS, TanStack Query, MSW)
- **Trạng thái:** Approved / Sẵn sàng bàn giao cho `senior-dev` (9router_DEV)
- **Tham chiếu:**
  - `AGENTS.md` (10 quy tắc tối thượng)
  - `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\danh-sach-viec-can-lam-frontend.md` (TODO-05, TODO-01, TODO-04, TODO-02, TODO-09)
  - `docs/02-features-by-role.md` (GST-01, CUS-15, OWN-09)
  - `docs/05-booking-and-realtime.md` (Vòng đời booking & no-show)
  - `docs/07-design-system.md` & `docs/08-ui-quality-rules.md` (Anti-AI Design & UI Rules)
  - `docs/11-api-contract.md` (Envelope `{ data, meta }`, PaginationMeta)

---

## 1. Tổng quan & Mục tiêu Kỹ thuật BATCH 1

Batch 1 tập trung xử lý toàn bộ các điểm nghẽn nghiêm trọng (P0) đang chặn việc nghiệm thu hệ thống và đưa tỷ lệ Unit test từ đỏ (284/285) lên **xanh 100% (285/285 tests passed)**:

| STT | Mã việc | Tên việc cần làm | Mức độ | Phạm vi giải quyết |
|:---:|:---|:---|:---:|:---|
| 1 | **TODO-05** | Khắc phục 1 Unit test đỏ tại `SplashBrandReveal` | **P1 (Hotfix)** | Khắc phục lệch chuỗi slogan footer badge, thống nhất `Phiên bản 2.2.0 • Web & Mobile Synchronized`. Đưa toàn bộ test suite về trạng thái 100% xanh. |
| 2 | **TODO-01** | Hoàn thiện bộ lọc GST-01 + Phân trang danh sách sân | **P0** | Xây dựng mới `VenueFilters.tsx` (Tỉnh/thành, Quận/huyện, Môn thể thao, Mức giá trần, Đánh giá tối thiểu, Tiện ích, Sắp xếp). Xây dựng component dùng chung `pagination.tsx` chuẩn touch-target ≥ 44px. Đồng bộ 2 chiều URL Query Params. Đủ 3 trạng thái (Skeleton, EmptyState, ErrorState). |
| 3 | **TODO-04** | Tải ảnh đại diện trong trang hồ sơ cá nhân (CUS-15) | **P0** | Tích hợp upload avatar tại `ProfileScreen.tsx` (preview tròn, validate file client ≤ 2MB định dạng ảnh, upload spinner, toast thông báo). Tự động cập nhật `Header.tsx` (Desktop & Mobile) hiển thị avatar URL thay vì chỉ hiển thị ký tự đầu. |
| 4 | **TODO-02** | Thêm thao tác "Đánh dấu No-show" cho Chủ sân (OWN-09) | **P0** | Bổ sung client API `markBookingNoShow(bookingId)`. Bổ sung handler MSW `POST /api/v1/owner/bookings/:id/no-show`. Tích hợp nút thao tác có điều kiện (`confirmed` VÀ quá giờ bắt đầu), hộp thoại xác nhận an toàn, toast feedback và query invalidation trong `OwnerBookingsScreen.tsx`. |
| 5 | **TODO-09** | Vá lỗ hổng bảo mật route `/dashboard` | **P1 (Security)** | Loại bỏ route thừa `app/(owner)/dashboard/` (dư thừa so với `app/(owner)/owner/dashboard/`). Bổ sung cơ chế redirect trong `middleware.ts` ép buộc `/dashboard` trỏ về `/owner/dashboard` nằm sau guard bảo vệ vai trò. |

---

## 2. Tiêu chuẩn Thiết kế Anti-AI (Strict Anti-AI Rules)

Tuân thủ nghiêm ngặt theo `docs/07-design-system.md`, `docs/08-ui-quality-rules.md` và `AGENTS.md`:

| Tiêu chí | ❌ HÀNH VI CẤM (AI Slop / Cliche) | ✅ CHUẨN THIẾT KẾ DỰ ÁN (Linear / Stripe Standard) |
|---|---|---|
| **Màu sắc & Gradient** | CẤM gradient neon tím/hồng/xanh (`from-purple-500 to-pink-500`, `from-indigo-600`), cấm glassmorphism lạm dụng. | 100% màu sắc lấy từ token: Nền trắng `neutral-0` (`#ffffff`), nền xám nhẹ `neutral-50` (`#f8fafc`), viền `neutral-200` (`#e2e8f0`), text chính `neutral-900` (`#0f172a`), màu thương hiệu `primary-700` (`#15803d`). |
| **Bo góc (Border Radius)** | CẤM bo góc dị dạng `rounded-3xl` cho card hoặc modal. CẤM bo tròn toàn bộ nút bấm `rounded-full` một cách tùy tiện. | Button / Input: `rounded-md` (6px) hoặc `rounded-btn` (8px). Card: `rounded-lg` (8px). Modal: `rounded-xl` (12px). Avatar / Badge tròn: `rounded-full`. |
| **Biểu tượng (Icons)** | CẤM chèn emoji rác (⚽, 🔍, 🚀, ✨, 📷, ⚠️, ❌) vào nút bấm, nhãn hoặc văn bản UI. | 100% biểu tượng dùng `lucide-react` kích thước cố định (16px, 18px, 20px), nét stroke 1.5px. |
| **Hộp thoại tương tác** | CẤM dùng `window.alert()`, `window.confirm()` hoặc `window.prompt()`. | Sử dụng `<Dialog>` Radix UI chuẩn accessible với tiêu đề, mô tả rõ ràng, nút hủy (outline) và nút xác nhận (primary/danger). |
| **Vùng chạm (Touch Target)** | Vùng chạm nhỏ hơn 44px trên thiết bị di động. | Nút phân trang, nút icon, input chọn file: luôn bảo đảm `min-h-11 min-w-11` (≥ 44px). |
| **Trạng thái Component** | Thiếu một trong các trạng thái tương tác hoặc chỉ xoay vòng vô hạn. | Đủ 6 trạng thái bắt buộc: `Default`, `Hover`, `Focus-visible` (ring outline 2px), `Loading` (spinner/skeleton), `Disabled` (opacity 50%, cursor-not-allowed), `Empty` / `Error`. |

---

## 3. Chi tiết Kỹ thuật từng Đầu việc

---

### 3.1. [TODO-05] Sửa Test Đỏ SplashBrandReveal (Hotfix)

#### Hiện trạng & Nguyên nhân gốc rễ (Root Cause)
- **Vị trí file:**
  - Component: `apps/web/components/common/SplashBrandReveal.tsx:284`
  - File test: `apps/web/components/common/SplashBrandReveal.test.tsx:44`
- **Nguyên nhân:**
  - File test `SplashBrandReveal.test.tsx` (dòng 44) kiểm tra:
    ```typescript
    expect(screen.getByText('Phiên bản 2.2.0 • Web & Mobile Synchronized')).not.toBeNull();
    ```
  - Trong khi đó, component `SplashBrandReveal.tsx` (dòng 284) đang render:
    ```tsx
    <span className="text-[11px] sm:text-xs text-neutral-400 font-normal">
        Phiên bản 2.2.0 • Pioneering In Technology
    </span>
    ```
  - Sự sai lệch chuỗi slogan định vị phiên bản khiến test case `TC-SPLASH-01` bị fail (1 failed / 285 tests).

#### Giải pháp Đặc tả Kỹ thuật
- **Chuỗi chuẩn xác thống nhất:** `"Phiên bản 2.2.0 • Web & Mobile Synchronized"`.
  - *Ý nghĩa nghiệp vụ:* Nhấn mạnh tính đồng bộ dữ liệu thời gian thực giữa Web Client và Mobile App Flutter theo định hướng kiến trúc của BookSportsCourt.
- **Thay đổi cần thực hiện:**
  - Sửa dòng 284 trong `apps/web/components/common/SplashBrandReveal.tsx`:
    ```tsx
    <span className="text-[11px] sm:text-xs text-neutral-400 font-normal">
        Phiên bản 2.2.0 • Web & Mobile Synchronized
    </span>
    ```
- **Tiêu chí nghiệm thu:** Chạy lệnh `pnpm --filter @bsc/web test` đạt kết quả `285 passed / 285 tests` (100% pass).

---

### 3.2. [TODO-01] Hoàn thiện Bộ lọc GST-01 & Component Phân trang Pagination

#### Hiện trạng
- Trang `apps/web/app/(public)/venues/page.tsx` hiện chỉ gửi 2 tham số `q` (từ khoá) và `sportIds` (môn thể thao đơn lẻ từ pill).
- Hàm `listVenues(params: VenueListParams)` và MSW handler `/api/v1/venues` đã hỗ trợ đầy đủ các tham số lọc:
  - `provinceId`: Mã tỉnh/thành phố
  - `districtId`: Mã quận/huyện
  - `sportIds`: Danh sách mã môn thể thao (`string[]`)
  - `amenityIds`: Danh sách mã tiện ích (`string[]`)
  - `minPrice`: Mức giá tối thiểu
  - `maxPrice`: Mức giá tối đa
  - `minRating`: Đánh giá sao tối thiểu (3.0, 4.0, 4.5)
  - `sort`: Tiêu chí sắp xếp (`'rating_desc' | 'price_asc' | 'price_desc' | 'newest'`)
  - `page`: Trang hiện tại (1-based index)
  - `limit`: Số lượng bản ghi trên một trang (mặc định 12)
- Chưa có giao diện để người dùng thiết lập các tham số này. Chưa có phân trang khiến danh sách kết quả bị giới hạn ở 10 bản ghi mặc định của mock handler. Chưa đồng bộ state lọc vào URL search params khiến không thể bookmark hoặc chia sẻ link tìm kiếm.

#### Giải pháp Kiến trúc & Đặc tả Component mới

#### A. Component Phân trang Dùng chung: `apps/web/components/ui/pagination.tsx`
Component phân trang độc lập, chuẩn accessible, tuân thủ Stripe / Linear Design System:
- **Props Interface:**
  ```typescript
  export interface PaginationProps {
    /** Trang hiện tại (1-based index) */
    currentPage: number;
    /** Tổng số trang */
    totalPages: number;
    /** Callback khi người dùng chuyển trang */
    onPageChange: (page: number) => void;
    /** Vô hiệu hoá tương tác khi đang nạp dữ liệu ngầm */
    disabled?: boolean;
    /** Bán kính hiển thị trang xung quanh trang hiện tại (mặc định: 1) */
    siblingCount?: number;
    /** Class CSS bổ sung */
    className?: string;
  }
  ```
- **Thuật toán sinh dải trang (Pagination Range):**
  - Luôn hiển thị trang đầu (1) và trang cuối (`totalPages`).
  - Trang hiện tại cùng các trang lân cận `[currentPage - siblingCount ... currentPage + siblingCount]`.
  - Hiển thị dấu ba chấm `...` (Ellipsis) khi khoảng cách giữa trang đầu/cuối và các trang lân cận > 1.
  - Ví dụ `totalPages = 10`:
    - `currentPage = 1`: `[1, 2, 3, '...', 10]`
    - `currentPage = 5`: `[1, '...', 4, 5, 6, '...', 10]`
    - `currentPage = 10`: `[1, '...', 8, 9, 10]`
- **Quy chuẩn UX / Anti-AI:**
  - Nút "Trang trước" (icon `ChevronLeft`) và "Trang sau" (icon `ChevronRight`) với `aria-label` rõ ràng.
  - Vùng chạm `min-h-11 min-w-11` (≥ 44px) đáp ứng chuẩn mobile touch target.
  - Trang đang chọn: nền `primary-700 text-white font-semibold shadow-xs`.
  - Trang thường: viền mỏng `border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50`.
  - Disabled: `opacity-50 cursor-not-allowed` khi ở trang đầu hoặc trang cuối, không ẩn nút để tránh giật vị trí layout.

#### B. Component Bộ lọc Sân: `apps/web/components/features/venue/VenueFilters.tsx`
Component quản lý toàn bộ các tiêu chí tìm kiếm nâng cao theo chuẩn GST-01:
- **Props Interface:**
  ```typescript
  export interface VenueFilterValues {
    q?: string;
    provinceId?: string;
    districtId?: string;
    sportIds?: string[];
    amenityIds?: string[];
    maxPrice?: number;
    minRating?: number;
    sort?: 'rating_desc' | 'price_asc' | 'price_desc' | 'newest';
    page?: number;
  }

  export interface VenueFiltersProps {
    values: VenueFilterValues;
    onChange: (nextValues: VenueFilterValues) => void;
    onReset: () => void;
    totalResults?: number;
    isLoading?: boolean;
    className?: string;
  }
  ```
- **Các trường dữ liệu & Nguồn Catalog:**
  1. **Tỉnh / Thành phố (`provinceId`):** Gọi `listProvinces()`. Render qua `NativeSelect` hoặc `Select`. Lựa chọn mặc định là "Tất cả Tỉnh/Thành".
  2. **Quận / Huyện (`districtId`):** Khi chọn `provinceId`, gọi `listDistricts(provinceId)`. Nếu chưa chọn tỉnh, dropdown Quận/Huyện ở trạng thái `disabled` với placeholder "Chọn Tỉnh/Thành trước". Khi người dùng đổi tỉnh, tự động reset `districtId = undefined`.
  3. **Môn thể thao (`sportIds`):** Gọi `listSports()`. Cho phép lọc đa môn thông qua pill buttons hoặc checkbox list linh hoạt.
  4. **Tiện ích sân (`amenityIds`):** Gọi `listAmenities()`. Checkbox group đa lựa chọn (ví dụ: Bãi đỗ xe ô tô, Căn tin, Phòng tắm nóng lạnh, Đèn chiếu ban đêm, Wifi miễn phí...).
  5. **Mức giá trần (`maxPrice`):** Dropdown hoặc slider với các mốc thông dụng: "Tất cả mức giá", "Dưới 150.000 ₫/h", "Dưới 300.000 ₫/h", "Dưới 500.000 ₫/h", "Dưới 1.000.000 ₫/h".
  6. **Đánh giá tối thiểu (`minRating`):** Lựa chọn số sao: "Tất cả", "Từ 3.0 sao trở lên", "Từ 4.0 sao trở lên", "Từ 4.5 sao trở lên".
  7. **Sắp xếp (`sort`):**
     - `rating_desc`: Đánh giá cao nhất (mặc định)
     - `price_asc`: Giá từ thấp đến cao
     - `price_desc`: Giá từ cao đến thấp
     - `newest`: Sân mới nhất
- **Layout & Trải nghiệm:**
  - Desktop: Thanh lọc dạng Card sticky hoặc Toolbar ngang tích hợp bộ lọc nhanh + nút "Bộ lọc nâng cao" (mở Sheet/Collapsible panel).
  - Mobile: Nút "Bộ lọc" kèm Badge đếm số lượng bộ lọc đang kích hoạt, mở Sheet trượt từ cạnh phải hoặc Modal toàn màn hình với nút "Áp dụng" cố định ở đáy.
  - Nút "Đặt lại bộ lọc" (Clear filters): Reset toàn bộ tiêu chí về mặc định và xoá search params trên URL.

#### C. Đồng bộ 2 chiều với URL Search Params trong `apps/web/app/(public)/venues/page.tsx`
- **Đọc từ URL khi khởi tạo:**
  ```typescript
  const searchParams = useSearchParams();
  // Đọc q, provinceId, districtId, sportIds (lặp param hoặc phân tách), amenityIds, maxPrice, minRating, sort, page
  ```
- **Ghi vào URL khi thay đổi:**
  - Sử dụng `useRouter().replace` kèm `scroll: false` để không giật màn hình lên đầu trang.
  - Khi thay đổi bất kỳ bộ lọc nào (`provinceId`, `sportIds`, `maxPrice`...), tự động đặt lại `page = 1`.
  - Tham số rỗng/mặc định sẽ bị xoá khỏi URL để giữ URL ngắn gọn và sạch sẽ (`/venues?provinceId=p-hn&sportIds=sp-pickleball&sort=price_asc`).
- **Debounce từ khoá:**
  - Input tìm kiếm theo từ khoá (`q`) có debounce 350ms trước khi cập nhật URL và kích hoạt query.
- **Xử lý đủ 3 trạng thái cốt lõi:**
  1. `venuesQuery.isPending`: Render 6 thẻ Skeleton (`aspect-video`, title, subtitle, price).
  2. `venuesQuery.isError`: Render `ErrorState` có thông báo lỗi từ `ApiError` và nút "Thử lại" gọi `venuesQuery.refetch()`.
  3. `venues.length === 0`: Render `EmptyState` với icon `MapPin`, tiêu đề "Không tìm thấy sân phù hợp", mô tả "Thử điều chỉnh lại bộ lọc hoặc tìm kiếm theo khu vực khác", nút bấm "Xóa bộ lọc" để reset toàn bộ params.

---

### 3.3. [TODO-04] Tải ảnh đại diện trong trang hồ sơ cá nhân (CUS-15)

#### Hiện trạng
- Hàm `uploadAvatar(file: File)` đã được khai báo hoàn chỉnh tại `apps/web/lib/api/endpoints/auth.ts:95`:
  ```typescript
  export function uploadAvatar(file: File) {
    const form = new FormData();
    form.append('avatar', file);
    return apiFetch<AuthResult>('/users/me/avatar', { method: 'POST', body: form });
  }
  ```
- Mock handler MSW tại `apps/web/mocks/handlers/auth.ts:172` đã sẵn sàng kiểm tra file size ≤ 2MB, sinh `avatarUrl` từ Dicebear initials và trả về `{ user: publicUser(user) }`.
- Giao diện `apps/web/components/features/auth/ProfileScreen.tsx` hiện chỉ cho phép sửa Họ tên và Số điện thoại, chưa có khu vực tải ảnh đại diện.
- `apps/web/components/common/Header.tsx` (dòng 142 và 286) chỉ render chữ cái đầu của họ tên trong vòng tròn, không kiểm tra `user.avatarUrl`.

#### Giải pháp Đặc tả Kỹ thuật

#### A. Cập nhật `ProfileScreen.tsx`
- **Khối Avatar Preview & Tải ảnh:**
  - Vị trí: Đặt ở đầu thẻ Card thông tin cá nhân hoặc khối độc lập ngay phía trên form `ProfileForm`.
  - Thành phần giao diện:
    1. Vòng tròn Avatar lớn (`size-24` tức 96x96px), viền mỏng `border-2 border-neutral-200`, bo tròn `rounded-full`, có bóng đổ nhẹ.
    2. Hiển thị ảnh: Nếu `user.avatarUrl` có giá trị, render `<img src={user.avatarUrl} alt={user.fullName} className="size-full rounded-full object-cover" />`. Nếu chưa có ảnh, render chữ cái viết hoa đầu tiên trên nền `bg-primary-100 text-primary-700 font-bold text-2xl`.
    3. Trạng thái Loading: Khi mutation đang tải file (`uploadMutation.isPending`), hiển thị lớp phủ mờ `bg-black/40` và `Spinner` màu trắng ở tâm vòng tròn kèm thuộc tính `aria-label="Đang tải ảnh lên"`.
    4. Nút bấm thao tác: Nút "Đổi ảnh đại diện" (variant `outline`, icon `Camera` từ Lucide, touch target `min-h-11`).
    5. Input file ẩn:
       ```tsx
       <input
         ref={fileInputRef}
         type="file"
         accept="image/jpeg,image/png,image/webp"
         className="hidden"
         aria-hidden="true"
         onChange={handleFileChange}
       />
       ```
    6. Dòng gợi ý kỹ thuật: Text nhỏ `text-xs text-neutral-500`: "Định dạng JPG, PNG hoặc WebP. Dung lượng tối đa 2MB."
- **Validation Client-side nghiêm ngặt:**
  - Định dạng: Kiểm tra `file.type`. Chỉ chấp nhận `['image/jpeg', 'image/png', 'image/webp']`. Nếu không đúng, báo lỗi ngay lập tức: `toast.error("Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WebP.")` và huỷ thao tác.
  - Dung lượng: Kiểm tra `file.size <= 2 * 1024 * 1024` (2MB). Nếu vượt quá, báo lỗi: `toast.error("Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.")` và huỷ thao tác.
- **Xử lý Mutation & Đồng bộ Dữ liệu:**
  - Sử dụng TanStack Query mutation:
    ```typescript
    const uploadAvatarMutation = useMutation({
      mutationFn: uploadAvatar,
      onSuccess: async (result) => {
        // Cập nhật ngay cache query authKeys.me()
        queryClient.setQueryData(authKeys.me(), (old: any) => ({
          ...old,
          user: result.user,
        }));
        await queryClient.invalidateQueries({ queryKey: authKeys.me() });
        toast.success("Cập nhật ảnh đại diện thành công");
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Tải ảnh đại diện thất bại");
      },
    });
    ```

#### B. Cập nhật `Header.tsx`
- Tại vị trí hiển thị avatar người dùng (Desktop Dropdown Trigger dòng 142-144 và Mobile Drawer dòng 286-288):
  - Kiểm tra điều kiện `user.avatarUrl`:
    ```tsx
    {user.avatarUrl ? (
      <img
        src={user.avatarUrl}
        alt={user.fullName}
        className="size-8 rounded-full object-cover border border-neutral-200"
      />
    ) : (
      <div className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
        {user.fullName.slice(0, 1).toUpperCase()}
      </div>
    )}
    ```
  - Mobile Drawer tương tự với kích thước `size-9` (36x36px).

---

### 3.4. [TODO-02] Đánh dấu Khách không đến (OWN-09 No-Show)

#### Nghiệp vụ theo Vòng đời Booking (`docs/05-booking-and-realtime.md`)
- Trạng thái `no_show` là trạng thái kết thúc (terminal state) của đơn đặt sân.
- **Điều kiện tiên quyết để được đánh dấu `no_show`:**
  1. Đơn đặt sân đang ở trạng thái `status === 'confirmed'`.
  2. Thời điểm hiện tại phải **lớn hơn thời gian bắt đầu trận đấu** (`new Date() > new Date(booking.during.start)`). Nếu chưa đến giờ bắt đầu, chủ sân không được phép đánh dấu vắng mặt.
  3. Người thực hiện phải là Chủ sở hữu (Owner) của cơ sở chứa sân đó hoặc Quản trị viên (Admin).

#### Giải pháp Đặc tả Kỹ thuật

#### A. Khai báo Client API: `apps/web/lib/api/endpoints/owner.ts`
- Khai báo hàm gọi endpoint theo đúng hợp đồng:
  ```typescript
  /**
   * Đánh dấu khách không đến nhận sân (OWN-09).
   * Chuyển trạng thái đơn từ `confirmed` sang `no_show`.
   */
  export function markBookingNoShow(bookingId: string) {
    return apiFetch<Booking>(`/owner/bookings/${encodeURIComponent(bookingId)}/no-show`, {
      method: 'POST',
    });
  }
  ```

#### B. Khởi tạo Handler MSW: `apps/web/mocks/handlers/owner.ts`
- Bổ sung mock handler xử lý `POST /api/v1/owner/bookings/:id/no-show`:
  ```typescript
  http.post('/api/v1/owner/bookings/:id/no-show', async ({ params }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const record = db.bookings.find((b) => b.booking.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt sân');

    const venueId = venueIdForCourt(record.booking.courtId);
    if (!ownedVenues().some((v) => v.id === venueId)) {
      return err(403, 'FORBIDDEN', 'Bạn không có quyền quản lý đơn đặt sân này');
    }

    if (record.booking.status !== 'confirmed') {
      return err(422, 'INVALID_STATUS', 'Chỉ có thể đánh dấu vắng mặt cho đơn đã xác nhận');
    }

    const now = new Date();
    const startTime = new Date(record.booking.during.start);
    if (now <= startTime) {
      return err(422, 'BOOKING_NOT_STARTED', 'Chưa đến giờ diễn ra trận đấu, không thể đánh dấu vắng mặt');
    }

    record.booking.status = 'no_show';
    persist();

    // Thông báo cho khách hàng nếu có tài khoản
    if (record.booking.customerId) {
      createMockNotification(record.booking.customerId, {
        type: 'booking_no_show',
        title: 'Đơn đặt sân ghi nhận vắng mặt',
        body: `Bạn đã không đến nhận sân vào lúc ${formatTime(startTime)}.`,
        payload: { bookingId: record.booking.id },
      });
      publish({
        type: 'booking_no_show',
        targetUserId: record.booking.customerId,
        payload: { bookingId: record.booking.id },
      });
    }

    return ok(record.booking);
  }),
  ```

#### C. Cập nhật UI: `apps/web/components/features/owner/OwnerBookingsScreen.tsx`
- **Nút thao tác "Khách không đến (No-show)":**
  - Hiển thị tại cột Thao tác của bảng danh sách hoặc trong Dialog chi tiết đơn.
  - Điều kiện hiển thị nút:
    ```typescript
    const canMarkNoShow =
      booking.status === 'confirmed' &&
      new Date() > new Date(booking.during.start);
    ```
  - Thiết kế nút: Variant `outline` với chữ cảnh báo `text-danger hover:bg-danger-50 border-danger/30`, icon `UserX` (Lucide 16px), touch-target `min-h-11`.
- **Hộp thoại xác nhận (Confirmation Dialog):**
  - Ngăn ngừa hoàn toàn hành vi click nhầm vì `no_show` là trạng thái terminal không thể hoàn tác.
  - Tiêu đề: *"Xác nhận khách vắng mặt (No-show)?"*
  - Nội dung mô tả: *"Đơn đặt sân mã #{bookingId.slice(0, 8)} sẽ chuyển sang trạng thái Vắng mặt. Hành động này không thể hoàn tác."*
  - Nút Hủy: Variant `outline`, nhãn *"Đóng"*.
  - Nút Xác nhận: Variant `danger`, nhãn *"Xác nhận vắng mặt"*, có trạng thái `loading` khi mutation đang chạy.
- **Xử lý Mutation & Feedback:**
  - Khi thành công:
    - Đóng dialog xác nhận.
    - `toast.success("Đã đánh dấu đơn đặt sân là khách không đến (No-show)")`.
    - `queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] })`.
    - `queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] })`.
  - Khi thất bại:
    - `toast.error(err instanceof ApiError ? err.message : "Thao tác thất bại")`.

---

### 3.5. [TODO-09] Vá Lỗ hổng Bảo mật & Chuẩn hóa Route `/owner/dashboard`

#### Hiện trạng & Rủi ro Bảo mật
- **Phát hiện:**
  - Tồn tại đồng thời 2 route thư mục cho màn hình Owner Dashboard:
    1. `apps/web/app/(owner)/dashboard/page.tsx` & `loading.tsx` (Route URL: `/dashboard`)
    2. `apps/web/app/(owner)/owner/dashboard/page.tsx` (Route URL: `/owner/dashboard`)
  - Trong `apps/web/middleware.ts`:
    - Nhánh bảo vệ chủ sân (dòng 53):
      ```typescript
      const isOwnerRoute = pathname.startsWith('/owner') && pathname !== '/owner/apply';
      ```
    - Route `/dashboard` **KHÔNG** bắt đầu bằng `/owner`, do đó vượt qua middleware guard hoàn toàn mà không bị kiểm tra phiên đăng nhập hay vai trò! Bất kỳ người dùng vãng lai nào gõ `/dashboard` đều có thể tải màn hình này.
  - Toàn bộ menu hệ thống (`dashboard-nav.ts`, `Header.tsx`) đều trỏ chuẩn về `/owner/dashboard`.

#### Giải pháp Đặc tả Kỹ thuật
1. **Xoá thư mục route thừa:**
   - Xoá hoàn toàn thư mục `apps/web/app/(owner)/dashboard/` (bao gồm `page.tsx` và `loading.tsx`).
   - Thư mục chuẩn duy nhất là `apps/web/app/(owner)/owner/dashboard/page.tsx`.
2. **Cập nhật `middleware.ts` với quy tắc chuyển hướng (Redirect Rule):**
   - Thêm xử lý chuyển hướng ngay đầu middleware:
     ```typescript
     // Chuẩn hoá đường dẫn dashboard cũ về route chính thức /owner/dashboard
     if (pathname === '/dashboard') {
       const url = request.nextUrl.clone();
       url.pathname = '/owner/dashboard';
       return NextResponse.redirect(url, 308); // Permanent redirect
     }
     ```
   - Khi chuyển hướng sang `/owner/dashboard`, request sẽ ngay lập tức được kiểm tra bởi nhánh `isOwnerRoute`:
     - Nếu chưa đăng nhập: redirect sang `/login?next=/owner/dashboard`.
     - Nếu đăng nhập với vai trò không phải `owner` hoặc `admin`: rewrite sang `/not-found` (404).
     - Nếu là `owner`/`admin`: cho phép truy cập bình thường.
3. **Rà soát liên kết nội bộ:** Đảm bảo toàn bộ codebase chỉ sử dụng `/owner/dashboard`.

---

## 4. Kiến trúc File & Component (Impact Matrix)

| Hành động | Đường dẫn File | Mục đích & Chi tiết triển khai |
|---|---|---|
| **EDIT** | `apps/web/components/common/SplashBrandReveal.tsx` | Khắc phục slogan thành `"Phiên bản 2.2.0 • Web & Mobile Synchronized"` (sửa test đỏ). |
| **CREATE** | `apps/web/components/ui/pagination.tsx` | Component phân trang dùng chung chuẩn Stripe/Linear (touch-target ≥ 44px, ellipsis, accessible). |
| **CREATE** | `apps/web/components/features/venue/VenueFilters.tsx` | Component bộ lọc sân GST-01 (Tỉnh/Thành, Quận/Huyện, Môn, Tiện ích, Giá, Đánh giá, Sắp xếp). |
| **EDIT** | `apps/web/app/(public)/venues/page.tsx` | Tích hợp `VenueFilters` và `Pagination`. Đồng bộ 2 chiều URL Search Params, xử lý 3 trạng thái. |
| **EDIT** | `apps/web/components/features/auth/ProfileScreen.tsx` | Bổ sung khu vực upload avatar, file validation (≤ 2MB, định dạng), spinner loading, toast. |
| **EDIT** | `apps/web/components/common/Header.tsx` | Render ảnh `user.avatarUrl` cho Desktop dropdown và Mobile drawer (fallback chữ cái đầu). |
| **EDIT** | `apps/web/lib/api/endpoints/owner.ts` | Thêm hàm `markBookingNoShow(bookingId: string)`. |
| **EDIT** | `apps/web/mocks/handlers/owner.ts` | Thêm mock handler `POST /api/v1/owner/bookings/:id/no-show` (validate status & thời gian). |
| **EDIT** | `apps/web/components/features/owner/OwnerBookingsScreen.tsx` | Thêm nút No-show có điều kiện, Dialog xác nhận chống click nhầm, invalidate queries. |
| **DELETE** | `apps/web/app/(owner)/dashboard/page.tsx` | Xoá route thừa hở bảo mật. |
| **DELETE** | `apps/web/app/(owner)/dashboard/loading.tsx` | Xoá loading boundary của route thừa đã xoá. |
| **EDIT** | `apps/web/middleware.ts` | Bổ sung redirect 308 từ `/dashboard` sang `/owner/dashboard`. |

---

## 5. Ma trận Kiểm thử Chi tiết (Test Matrix cho `auto-tester`)

Tất cả các test case dưới đây là **BẮT BUỘC** `auto-tester` phải triển khai và chạy pass 100%:

### Nhóm 1: Unit & Component Test SplashBrandReveal (TC-SPLASH)
- `TC-SPLASH-01` (Fix test đỏ hiện tại): Render `SplashBrandReveal`, kỳ vọng xuất hiện chuỗi `"Phiên bản 2.2.0 • Web & Mobile Synchronized"`. Toàn bộ 10 test case trong `SplashBrandReveal.test.tsx` pass xanh.

### Nhóm 2: Unit & Component Test Pagination (`pagination.test.tsx`)
- `TC-PAGIN-01`: Không render gì (`null`) khi `totalPages <= 1`.
- `TC-PAGIN-02`: Render đầy đủ các nút trang khi `totalPages = 5` (các số 1, 2, 3, 4, 5).
- `TC-PAGIN-03`: Hiển thị dấu ba chấm `...` khi `totalPages = 10` và `currentPage = 5` (dải `[1, '...', 4, 5, 6, '...', 10]`).
- `TC-PAGIN-04`: Nút "Trang trước" bị `disabled` khi `currentPage = 1`.
- `TC-PAGIN-05`: Nút "Trang sau" bị `disabled` khi `currentPage = totalPages`.
- `TC-PAGIN-06`: Bấm vào nút trang gọi callback `onPageChange` với số trang tương ứng.
- `TC-PAGIN-07`: Kiểm tra touch-target: mọi nút trang có class `min-h-11 min-w-11` (≥ 44px).

### Nhóm 3: Component Test VenueFilters & VenuesPage (`VenueFilters.test.tsx`)
- `TC-FILTER-01`: Render đủ các trường lọc (Tỉnh/Thành, Môn, Mức giá, Đánh giá, Sắp xếp).
- `TC-FILTER-02`: Dropdown Quận/Huyện bị disabled khi chưa chọn Tỉnh/Thành; khi chọn Tỉnh/Thành thì tự nạp danh sách Quận/Huyện tương ứng.
- `TC-FILTER-03`: Bấm nút "Xóa bộ lọc" kích hoạt callback `onReset` và đặt lại toàn bộ giá trị về mặc định.
- `TC-FILTER-04`: Thay đổi bộ lọc đồng bộ cập nhật URL Search Params (`?provinceId=...`).
- `TC-FILTER-05`: Render `EmptyState` khi kết quả lọc rỗng, bấm "Xóa lọc" đưa về URL ban đầu.

### Nhóm 4: Avatar Upload Test (`ProfileScreen.test.tsx`)
- `TC-AVATAR-01`: Hiển thị chữ cái đầu khi người dùng chưa có `avatarUrl`.
- `TC-AVATAR-02`: Hiển thị ảnh `<img>` với `src = avatarUrl` khi người dùng đã có avatar.
- `TC-AVATAR-03`: Chọn file sai định dạng (ví dụ `.pdf`, `.txt`) -> không gọi API, hiển thị thông báo lỗi format.
- `TC-AVATAR-04`: Chọn file quá dung lượng (> 2MB) -> không gọi API, hiển thị thông báo lỗi kích thước.
- `TC-AVATAR-05`: Chọn file hợp lệ (PNG 1MB) -> gọi `uploadAvatar`, hiển thị spinner loading trong lúc upload, cập nhật user profile sau khi thành công.

### Nhóm 5: No-show Booking Test (`OwnerBookingsScreen.test.tsx`)
- `TC-NOSHOW-01`: Đơn có trạng thái `cancelled` hoặc `completed` -> KHÔNG hiển thị nút "No-show".
- `TC-NOSHOW-02`: Đơn có trạng thái `confirmed` nhưng thời gian bắt đầu ở tương lai -> KHÔNG hiển thị nút "No-show".
- `TC-NOSHOW-03`: Đơn có trạng thái `confirmed` VÀ thời gian bắt đầu trong quá khứ -> HIỂN THỊ nút "No-show".
- `TC-NOSHOW-04`: Bấm nút "No-show" -> mở Dialog xác nhận, chưa gọi API ngay.
- `TC-NOSHOW-05`: Bấm xác nhận trong Dialog -> gọi `markBookingNoShow`, chuyển booking sang `no_show` và hiển thị toast thông báo thành công.

### Nhóm 6: Middleware & Security Route Test (`middleware.test.ts`)
- `TC-SEC-01`: Truy cập `/dashboard` -> nhận phản hồi redirect 308 sang `/owner/dashboard`.
- `TC-SEC-02`: Truy cập `/owner/dashboard` khi chưa đăng nhập -> redirect sang `/login?next=%2Fowner%2Fdashboard`.
- `TC-SEC-03`: Truy cập `/owner/dashboard` với vai trò `customer` -> rewrite 404 `/not-found` (không lộ route).
- `TC-SEC-04`: Truy cập `/owner/dashboard` với vai trò `owner` hoặc `admin` -> cho phép truy cập (200).

---

## 6. Hướng dẫn Chuyển giao Triển khai

1. Tài liệu này được bàn giao trực tiếp cho `senior-dev` (9router_DEV - Claude Opus 5.5).
2. `senior-dev` tiến hành code chính xác theo từng file và hợp đồng API đã đặc tả.
3. Sau khi `senior-dev` hoàn thành, `auto-tester` chạy kiểm thử tự động bám sát Test Matrix ở Mục 5.
4. `qa-inspector` kiểm định typecheck, lint, test coverage và đối soát Anti-AI trước khi nghiệm thu hoàn tất BATCH 1.
