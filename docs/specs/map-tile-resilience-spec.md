# ĐẶC TẢ KỸ THUẬT: TỰ ĐỘNG PHỤC HỒI VÀ DỰ PHÒNG NGUỒN TILE BẢN ĐỒ (MAP TILE RESILIENCE)

- **Mã tài liệu:** `SPEC-MAP-002`
- **Phiên bản:** `1.0.0`
- **Tác giả:** Product Architect & UX Specifier (`9router_BA`)
- **Trạng thái:** Approved / Sẵn sàng chuyển giao `senior-dev`
- **Dự án:** BookSportsCourt (Next.js 14.2 App Router · react-leaflet 4.2 · leaflet 1.9 · TypeScript Strict)
- **Tài liệu căn cứ:**
  - `AGENTS.md` (10 quy tắc tối thượng, quy tắc token, cấm emoji, đủ 6 trạng thái UI)
  - `docs/07-design-system.md` (bảng màu neutral Slate, primary sân cỏ, border radius token)
  - `docs/08-ui-quality-rules.md` (tiêu chuẩn Anti-AI Design, kiểm tra AA, cấm gradient neon)
  - `docs/09-frontend-conventions.md` (quy ước Server/Client Component, next/dynamic ssr:false)
  - `docs/11-api-contract.md` (hợp đồng endpoint `/venues/map` và toạ độ sân)
  - `docs/18-decision-log.md` (ADR-014: Leaflet + OpenStreetMap thay Google Maps)

---

## 1. Bối cảnh & Phân tích nguyên nhân gốc (Root-Cause Analysis)

### 1.1. Hiện trạng khảo sát thực tế tại codebase

Tại hai component hiển thị bản đồ cốt lõi của dự án:
1. `apps/web/components/features/venue/VenueMap.tsx` (dòng 126–129): Dùng trên trang tìm sân `/venues` (chế độ Bản đồ toàn màn hình và Chế độ Chia đôi danh sách/bản đồ).
2. `apps/web/components/features/venue/VenueLocationMap.tsx` (dòng 82–85): Dùng trên trang chi tiết cơ sở `/venues/[slug]` và hộp thoại tạo/sửa sân của chủ cơ sở `VenueFormDialog.tsx`.

Cả hai component đều đang thiết lập cứng một nguồn tile duy nhất:
```tsx
<TileLayer
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>
```

### 1.2. Phân tích nguyên nhân hiện tượng "Ô vuông màu trắng"

Hiện tượng người dùng báo cáo: *"Bản đồ không load hết, đôi lúc có ô vuông màu trắng"* xuất phát từ 4 nguyên nhân kỹ thuật cụ thể sau:

| # | Hiện tượng kỹ thuật | Cơ chế phát sinh | Hệ quả thị giác |
|---|---|---|---|
| **RC-01** | **DNS Block / Loopback Hijack** | Tại một số môi trường mạng nội bộ, máy dev hoặc mạng doanh nghiệp/nhà mạng tại Việt Nam, tên miền `tile.openstreetmap.org` bị phân giải về `127.0.0.1` hoặc timeout. | Kết nối HTTP thất bại hoàn toàn (`ERR_CONNECTION_REFUSED`), 100% các ô tile bị trắng tinh, bản đồ không hiển thị được bất kỳ chi tiết địa lý nào. |
| **RC-02** | **OSM Tile Usage Policy & Rate-limit HTTP 429** | OpenStreetMap Foundation áp dụng chính sách sử dụng khắt khe: nghiêm cấm lưu lượng truy cập lớn không kèm định danh rõ ràng, chặn hoặc trả về mã `429 Too Many Requests` khi có nhiều request đồng thời từ cùng một dải IP. | Một phần tile tải được, phần còn lại bị HTTP 429 tạo thành các mảng ô cờ trắng đan xen. |
| **RC-03** | **Zoom vượt ngưỡng maxNativeZoom (HTTP 404)** | Khi người dùng zoom sâu vào chi tiết sân (zoom level 18–19) trên bản đồ vị trí, máy chủ tile gốc của OSM không lưu trữ sẵn tile ở toạ độ đó và trả về `404 Not Found`. Mặc định Leaflet không co giãn tile mức trước đó nếu thiếu `maxNativeZoom`. | Khi zoom sâu, các ô tile biến mất, để lộ nền trống. |
| **RC-04** | **Thiếu cơ chế Fallback và Xử lý Lỗi của Leaflet** | Cả hai component hiện tại không đăng ký sự kiện `tileerror`, không có danh sách máy chủ dự phòng, không có thuộc tính `errorTileUrl`, không có `keepBuffer` để giữ tile khi chuyển khung nhìn. | Thẻ `<img>` của tile khi lỗi kích hoạt sự kiện `error` ngầm, Leaflet để trống `src` dẫn đến ô trắng trong suốt để lộ nền xám của khung chứa. |

*Lưu ý về CORS:* Thẻ `<img class="leaflet-tile">` hiển thị raster thông thường không bị chặn bởi chính sách Same-Origin Policy (CORS) trừ khi vẽ lên HTML5 Canvas. Tuy nhiên, việc thiếu `crossOrigin="anonymous"` ngăn cản trình duyệt tối ưu hoá bộ nhớ đệm HTTP và gây lỗi khi sau này xuất ảnh bản đồ.

### 1.3. Bảng đối chiếu & Đánh giá các nhà cung cấp Tile (Tile Providers Matrix)

| Nhà cung cấp | Endpoint URL mẫu | Yêu cầu API Key | Hạn mức Free | Độ tin cậy tại VN | Đánh giá & Rủi ro ToS |
|---|---|---|---|---|---|
| **CARTO Voyager** (Khuyên dùng #1) | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` (subdomains: `a`, `b`, `c`, `d`) | Không bắt buộc | 75.000 requests/tháng miễn phí cho open-source/non-commercial | **Rất cao** (CDN toàn cầu Cloudflare/Fastly) | Giao diện thanh lịch, sạch sẽ, chuẩn Linear/Stripe, tôn rõ điểm ghim sân cỏ. |
| **Esri ArcGIS World Street Map** (Dự phòng #1) | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}` | Không bắt buộc | Miễn phí công cộng phi thương mại | **Rất cao** (Hạ tầng đám mây Akamai/AWS) | Dữ liệu đường sá chính xác, máy chủ ổn định, hỗ trợ zoom tốt. |
| **OSM France HOT (Humanitarian)** (Dự phòng #2) | `https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png` (subdomains: `a`, `b`) | Không bắt buộc | Miễn phí phi lợi nhuận | **Cao** | Phù hợp dự phòng, bản đồ có độ tương phản cao, hạ tầng độc lập OSM org. |
| **OpenTopoMap** (Dự phòng #3) | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` (subdomains: `a`, `b`, `c`) | Không bắt buộc | Miễn phí cộng đồng | **Trung bình** (hạ tầng hạn chế) | Phong cách địa hình đồi núi, chỉ dùng làm cứu cánh cuối cùng. |
| **OpenStreetMap Standard** | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Không | Nghiêm ngặt (Fair-use) | **Kém** (bị DNS block tại một số mạng) | Giữ làm nguồn đối chiếu nhưng hạ độ ưu tiên xuống thấp. |
| **Stadia Maps** | `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key={apiKey}` | **Bắt buộc** | 200.000 credits/tháng | **Rất cao** | Yêu cầu đăng ký tài khoản lấy key. Trả 401 nếu thiếu key. |
| **MapTiler** | `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={apiKey}` | **Bắt buộc** | 100.000 requests/tháng | **Rất cao** (Cloudflare Edge) | Cung cấp raster tile chất lượng cao, cần key qua biến môi trường. |
| **Geoapify** | `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={apiKey}` | **Bắt buộc** | 3.000 requests/ngày | **Cao** | Phù hợp làm provider tùy chọn khi người dùng cấu hình key. |
| **Thunderforest** | `https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apiKey}` | **Bắt buộc** | 150.000 requests/tháng | **Cao** | Chuyên giao thông, cần key. |
| **Google Raster Direct** | `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}` (subdomains: `0`, `1`, `2`, `3`) | Không | Không công bố | **Cao** | **CẢNH BÁO VI PHẠM ĐIỀU KHOẢN (ToS Violation):** Điều khoản Google Maps Platform nghiêm cấm tải tile raster trực tiếp không qua SDK. **TUYỆT ĐỐI KHÔNG ĐẶT LÀM MẶC ĐỊNH**, chỉ giữ dạng tham khảo mở rộng. |

---

## 2. Mục tiêu kỹ thuật & Tiêu chí nghiệm thu đo lường được (Measurable Goals)

Tài liệu này xác lập các chỉ số chất lượng dịch vụ (SLA) bắt buộc cho hệ thống bản đồ của dự án:

1. **Tỷ lệ tải tile thành công (Tile Availability Rate):** Đạt **≥ 99.5%** tổng số request tile trên môi trường kiểm thử và vận hành thực tế ở cả 3 chế độ xem (`/venues` dạng map, dạng split, và dialog chọn vị trí sân).
2. **Loại bỏ hoàn toàn ô trắng (Zero Blank Tiles):** Không còn bất kỳ ô vuông trắng nào hiển thị trơ trọi khi có mạng Internet. Nếu một tile của provider chính bị lỗi, hệ thống phải tự động hoán đổi sang tile của provider dự phòng trong vòng **≤ 250ms**.
3. **Thời gian hiển thị tile đầu tiên (First Tile Render Time - FTRT):** Đạt **< 1.8 giây** trên kết nối băng thông tiêu chuẩn (nhờ preconnect DNS và cấu hình CDN ưu tiên cao).
4. **Tự động chuyển nguồn thông minh (Transparent Auto-Failover):** Khi một provider gặp sự cố hoàn toàn (chặn DNS hoặc sập máy chủ trả về 100% lỗi), component phải tự chuyển sang provider tiếp theo trong danh sách ưu tiên mà không làm treo UI, không cần người dùng tải lại trang.
5. **Cứu cánh cuối cùng (Graceful Degradation):** Nếu toàn bộ các nhà cung cấp bên ngoài đều không thể truy cập (ví dụ mất kết nối Internet hoàn toàn), hiển thị tile hoa văn trung tính (SVG Data URI màu Slate 1px) kèm thanh thông báo trạng thái nhẹ nhàng và nút "Thử lại", tuyệt đối không dùng popup alert cổ điển.

---

## 3. Danh mục Yêu cầu Kỹ thuật (Functional & Non-Functional Requirements)

| Mã yêu cầu | Phân loại | Tóm tắt yêu cầu | Mức độ ưu tiên |
|---|---|---|---|
| `REQ-MAP-01` | Chức năng | Xây dựng danh mục nhà cung cấp tile tập trung (`tile-providers.ts`) với thứ tự ưu tiên tối ưu và hỗ trợ kích hoạt key linh hoạt qua biến môi trường. | **P0 (Bắt buộc)** |
| `REQ-MAP-02` | Chức năng | Xây dựng component `ResilientTileLayer` bọc `TileLayer` của react-leaflet, bắt sự kiện `tileerror`, đếm lỗi trượt và tự động chuyển nguồn tile kế tiếp. | **P0 (Bắt buộc)** |
| `REQ-MAP-03` | Chức năng | Cung cấp thanh trạng thái phục hồi (`MapResilienceBar`) với thông báo tiếng Việt thanh lịch, không giật màn hình, có nút "Thử lại" khi toàn bộ nguồn lỗi. | **P0 (Bắt buộc)** |
| `REQ-MAP-04` | Hiệu năng | Bổ sung các thông số tối ưu hoá Leaflet: `keepBuffer={4}`, `updateWhenIdle={false}`, `maxNativeZoom={18}`, `maxZoom={19}`, `detectRetina={true}`. | **P1 (Quan trọng)** |
| `REQ-MAP-05` | Hiệu năng | Thiết lập preconnect và dns-prefetch cho các CDN tile chính trong `apps/web/app/layout.tsx` nhằm giảm tối đa Round-Trip Time (RTT). | **P1 (Quan trọng)** |
| `REQ-MAP-06` | Trải nghiệm | Cung cấp `errorTileUrl` dạng SVG Data URI trung tính (nền `#f1f5f9`, viền `#e2e8f0` mỏng 1px) làm phương án dự phòng cuối cùng chống ô trắng rác mắt. | **P1 (Quan trọng)** |
| `REQ-MAP-07` | Tuân thủ | Hiển thị chính xác chuỗi ghi nhận quyền tác giả (`attribution`) tương ứng theo provider đang kích hoạt, tuân thủ nghiêm ngặt giấy phép bản đồ mở. | **P0 (Bắt buộc)** |
| `REQ-MAP-08` | Anti-AI | Tuân thủ tuyệt đối quy tắc Anti-AI Design: không gradient neon tím hồng, không bo góc lố `rounded-3xl`, không dùng emoji rác, viền mỏng 1px Slate. | **P0 (Bắt buộc)** |

---

## 4. Thiết kế Kiến trúc & Giải pháp Kỹ thuật

### 4.1. Sơ đồ luồng xử lý và Máy trạng thái Tự phục hồi (Resilience State Machine)

```
[Bắt đầu Render Bản đồ]
        │
        ▼
[Lấy danh sách Provider khả dụng] ──(Duyệt biến môi trường NEXT_PUBLIC_*)
        │
        ▼
[Thử tải Tile với Provider ưu tiên cao nhất (Mặc định: CARTO Voyager)]
        │
        ├───────────────────────────────────────────────────────┐
        │                                                       │
  (Tile tải thành công: 200 OK)                          (Tile lỗi: tileerror)
        │                                                       │
        ▼                                                       ▼
[Ghi nhận thành công: reset error counter]               [Tăng bộ đếm lỗi trong cửa sổ trượt (sliding window 3s)]
        │                                                       │
        │                                                       ├─ Lỗi < ngưỡng (Ngưỡng: 6 tile lỗi liên tiếp)
        │                                                       │   └── Tiếp tục giữ provider hiện tại, chờ retry
        │                                                       │
        │                                                       └─ Lỗi ≥ ngưỡng (Đạt ngưỡng lỗi hàng loạt)
        │                                                           │
        │                                                           ▼
        │                                                [Kiểm tra danh sách Provider kế tiếp]
        │                                                           │
        │                                                           ├─ Còn Provider dự phòng (Ví dụ: Esri, OSM-FR...)
        │                                                           │   ├── Chuyển providerIndex = providerIndex + 1
        │                                                           │   ├── Hiển thị badge mỏng: "Đang đổi nguồn bản đồ..."
        │                                                           │   └── Nạp lại Layer với URL mới
        │                                                           │
        │                                                           └─ Đã hết toàn bộ Provider (Tất cả đều sập / Mất mạng)
        │                                                               ├── Kích hoạt errorTileUrl (SVG trung tính Slate)
        │                                                               └── Hiển thị thông báo trạng thái: "Không thể tải bản đồ"
        │                                                                   kèm nút "Thử lại thủ công"
```

### 4.2. Thiết kế Module Quản lý Cấu hình Provider (`lib/map/tile-providers.ts`)

Module này là nguồn chân lý duy nhất (Single Source of Truth) định nghĩa toàn bộ nhà cung cấp bản đồ, quy tắc ưu tiên, thông số zoom và cơ chế trích xuất API Key từ biến môi trường.

#### Danh sách Provider mặc định và Thứ tự Ưu tiên:
1. **`carto-voyager` (Ưu tiên 1 - Mặc định):** Độ ổn định cao nhất, không cần key, hỗ trợ Retina, thiết kế hiện đại màu sắc dịu nhẹ.
2. **`esri-world-street` (Ưu tiên 2):** Dự phòng số 1, hạ tầng của Esri cực kỳ bền bỉ, độ chi tiết cao, không cần key.
3. **`osm-france-hot` (Ưu tiên 3):** Dự phòng số 2, máy chủ tại châu Âu cho tổ chức nhân đạo, độ tin cậy tốt, không cần key.
4. **`opentopomap` (Ưu tiên 4):** Dự phòng số 3, phong cách địa hình bản đồ số, không cần key.
5. **`osm-standard` (Ưu tiên 5):** Dự phòng số 4, máy chủ OSM chuẩn.
6. **Nhóm Provider cần API Key (Tự động kích hoạt khi có Key):**
   - `maptiler-streets`: Kích hoạt khi có `NEXT_PUBLIC_MAPTILER_API_KEY` (Đẩy lên ưu tiên cao nhất nếu người dùng cung cấp key).
   - `stadia-smooth`: Kích hoạt khi có `NEXT_PUBLIC_STADIA_API_KEY`.
   - `geoapify-osm-bright`: Kích hoạt khi có `NEXT_PUBLIC_GEOAPIFY_API_KEY`.
   - `thunderforest-transport`: Kích hoạt khi có `NEXT_PUBLIC_THUNDERFOREST_API_KEY`.

#### Biến môi trường hỗ trợ (trong file `.env.example` và `apps/web/.env.local`):
```bash
# ── Bản đồ & Tile Providers (Tùy chọn - Tự động kích hoạt nếu có) ───────
NEXT_PUBLIC_MAPTILER_API_KEY=
NEXT_PUBLIC_STADIA_API_KEY=
NEXT_PUBLIC_GEOAPIFY_API_KEY=
NEXT_PUBLIC_THUNDERFOREST_API_KEY=
# Provider mặc định muốn ưu tiên (carto-voyager | esri-world-street | maptiler-streets ...)
NEXT_PUBLIC_DEFAULT_MAP_PROVIDER=carto-voyager
```

### 4.3. Hợp đồng Dữ liệu & Chữ ký TypeScript (`lib/map/types.ts`)

```typescript
/** Danh danh định danh các nhà cung cấp bản đồ đã được hỗ trợ */
export type MapProviderId =
  | 'carto-voyager'
  | 'esri-world-street'
  | 'osm-france-hot'
  | 'opentopomap'
  | 'osm-standard'
  | 'maptiler-streets'
  | 'stadia-smooth'
  | 'geoapify-osm-bright'
  | 'thunderforest-transport';

/** Cấu hình chi tiết của một nhà cung cấp tile */
export interface TileProviderConfig {
  /** Định danh duy nhất */
  id: MapProviderId;
  /** Tên hiển thị người dùng / kỹ thuật */
  name: string;
  /** Mẫu URL tile có chứa {z}/{x}/{y} và {s} nếu có */
  url: string;
  /** Chuỗi HTML ghi nhận bản quyền bắt buộc */
  attribution: string;
  /** Danh sách tên miền con để cân bằng tải (ví dụ ['a', 'b', 'c']) */
  subdomains?: string[] | string;
  /** Độ phóng đại tối đa mà bản đồ cho phép */
  maxZoom: number;
  /** Độ phóng đại tối đa thực tế của ảnh vệ tinh/vector raster (giúp Leaflet tự co phóng ảnh khi zoom sâu hơn) */
  maxNativeZoom: number;
  /** Độ phóng đại tối thiểu */
  minZoom?: number;
  /** Có yêu cầu API key hay không */
  requiresKey: boolean;
  /** Tên biến môi trường NEXT_PUBLIC_* tương ứng */
  keyEnvVar?: string;
  /** Điểm ưu tiên cơ bản (số càng nhỏ độ ưu tiên càng cao) */
  priority: number;
  /** Cờ hỗ trợ màn hình độ phân giải cao retina (@2x) */
  supportsRetina?: boolean;
}

/** Trạng thái phục hồi và chuyển đổi của Layer bản đồ */
export interface MapResilienceState {
  /** Vị trí index của provider đang sử dụng trong danh sách khả dụng */
  currentProviderIndex: number;
  /** Thông tin provider đang hoạt động */
  activeProvider: TileProviderConfig;
  /** Danh sách tất cả provider khả dụng (đã lọc các provider thiếu key) */
  availableProviders: TileProviderConfig[];
  /** Tổng số lỗi tile ghi nhận trên provider hiện tại */
  errorCount: number;
  /** Đang trong tiến trình chuyển đổi sang provider dự phòng */
  isSwitching: boolean;
  /** Toàn bộ danh sách provider đều đã thất bại */
  isAllFailed: boolean;
  /** Thông báo lỗi chi tiết phục vụ trợ năng / logging */
  statusMessage: string | null;
}

/** Callback thao tác phục hồi */
export interface MapResilienceActions {
  /** Đổi thủ công sang provider tiếp theo */
  switchToNextProvider: () => void;
  /** Thử lại từ đầu với provider ưu tiên số 1 */
  retryFromStart: () => void;
  /** Báo cáo một tile bị tải hỏng từ Leaflet tileerror event */
  reportTileError: () => void;
  /** Báo cáo một tile tải thành công để giữ ổn định */
  reportTileSuccess: () => void;
}
```

### 4.4. Component Lõi: `ResilientTileLayer` (`components/features/venue/map/ResilientTileLayer.tsx`)

Component này thay thế trực tiếp thẻ `<TileLayer />` tiêu chuẩn của `react-leaflet`.

#### Nguyên lý vận hành chi tiết:
1. Sử dụng hook `useMap()` để truy cập trực tiếp đối tượng bản đồ Leaflet (`L.Map`).
2. Khởi tạo một đối tượng `L.TileLayer` với cấu hình của provider đang được chọn (`activeProvider`).
3. Đăng ký các bộ lắng nghe sự kiện cấp thấp:
   - `tileerror`: Mỗi khi một tile 256x256 thất bại (do mạng, timeout hoặc 404/429), callback `reportTileError` được kích hoạt.
   - `tileload`: Đánh dấu tile tải thành công. Nếu trong một khung nhìn tải thành công ≥ 80% số tile, bộ đếm lỗi được giảm trừ dần để tránh chuyển đổi nhầm khi mạng chỉ chập chờn thoáng qua.
   - `loading` và `load`: Quản lý chỉ báo tiến trình tải của toàn bộ khung nhìn.
4. **Cơ chế Cửa sổ trượt (Sliding Error Window):**
   - Định nghĩa ngưỡng chuyển đổi: Nếu xảy ra liên tiếp **6 lỗi tile** trong khoảng thời gian trượt **3.000ms**, hệ thống xác định provider hiện tại đang bị chặn (như trường hợp DNS `tile.openstreetmap.org` trỏ về `127.0.0.1`) hoặc bị nghẽn mạng nghiêm trọng.
   - Hệ thống tự động huỷ bỏ layer hiện tại và gắn layer của provider kế tiếp trong danh sách khả dụng.
   - Giới hạn chuyển đổi: Tối đa duyệt qua toàn bộ số lượng provider có trong danh sách (thường từ 4–6 provider). Khi đã duyệt hết một vòng mà vẫn 100% lỗi, hệ thống chuyển sang trạng thái `isAllFailed = true`.
5. **Cấu hình tối ưu chống ô trắng:**
   - `keepBuffer: 4`: Giữ lại bộ đệm 4 hàng/cột tile bên ngoài khung nhìn đang thấy. Khi người dùng kéo rê bản đồ hoặc đổi toạ độ cơ sở, các tile đã được nạp sẵn giúp loại bỏ hoàn toàn hiện tượng nhấp nháy ô trắng.
   - `updateWhenIdle: false`: Tải tile liên tục ngay trong lúc đang cuộn hoặc zoom thay vì chờ kết thúc thao tác mới tải.
   - `maxNativeZoom: activeProvider.maxNativeZoom` (thường là 18): Nếu người dùng zoom lên 19 (đặc biệt khi xem chi tiết sân trong dialog), Leaflet sẽ lấy ảnh tile mức 18 và phóng to bằng thuật toán CSS nội suy thay vì gửi request 19 lên máy chủ rồi nhận lỗi 404 dẫn đến ô trắng.
   - `errorTileUrl`: Nhúng trực tiếp một SVG Data URI tinh gọn màu Slate trung tính (xem mục 4.6), giúp nếu có 1–2 tile đơn lẻ bị lỗi cục bộ thì ô đó hiện hoa văn xám nhạt đồng điệu với design system, không bị trắng xoá chói mắt.

### 4.5. Cơ chế Tối ưu Kết nối: Preconnect & DNS-Prefetch

Để đạt mục tiêu thời gian hiển thị tile đầu tiên < 1.8s, cần thêm các thẻ khai báo trước tài nguyên mạng vào phần `<head>` của trang web thông qua file `apps/web/app/layout.tsx`:

```html
<!-- Tối ưu kết nối trước đến các CDN Tile của Bản đồ -->
<link rel="preconnect" href="https://a.basemaps.cartocdn.com" crossOrigin="anonymous" />
<link rel="preconnect" href="https://b.basemaps.cartocdn.com" crossOrigin="anonymous" />
<link rel="preconnect" href="https://server.arcgisonline.com" crossOrigin="anonymous" />
<link rel="dns-prefetch" href="https://a.tile.openstreetmap.fr" />
<link rel="dns-prefetch" href="https://tile.opentopomap.org" />
```

Cơ chế này giúp trình duyệt thực hiện bắt tay DNS, TCP và TLS handshake từ sớm ngay khi người dùng vừa truy cập website, tiết kiệm từ 150ms – 400ms độ trễ mạng khi mở tab bản đồ.

### 4.6. Thiết kế Fallback Cuối cùng: SVG Error Tile Data URI

Khi toàn bộ nhà cung cấp tile bên ngoài đều không phản hồi (ví dụ thiết bị ngắt kết nối mạng), Leaflet sẽ sử dụng `errorTileUrl`. Thay vì để mặc định hiển thị ô ảnh vỡ của trình duyệt hoặc để trống trắng tinh, ta cấp một ảnh vector siêu nhẹ mã hoá Base64:

- **Nền:** `#f8fafc` (`--color-neutral-50` / Slate 50).
- **Đường kẻ lưới:** `#e2e8f0` (`--color-neutral-200` / Slate 200) độ dày 1px, tạo họa tiết caro 32x32px tinh tế.
- **Biểu tượng trung tâm:** Biểu tượng toạ độ mờ tối giản màu `#cbd5e1` (`--color-neutral-300`).
- **Dung lượng:** < 400 bytes, không phát sinh bất kỳ request HTTP nào ra Internet.

---

## 5. Quy tắc Thiết kế Anti-AI Design (Áp dụng cho Bản đồ & Trạng thái Lỗi)

Tuân thủ nghiêm ngặt chuẩn mực thiết kế của các hệ thống sản phẩm lớn (Linear, Stripe, Vercel, Booking.com) và các điều cấm trong `docs/08-ui-quality-rules.md`:

### 5.1. Danh mục CẤM tuyệt đối (Strict Prohibitions)
1. ❌ **CẤM:** Dùng popup `alert()`, `confirm()` của trình duyệt khi bản đồ gặp sự cố.
2. ❌ **CẤM:** Chèn emoji rác như 🚀, ✨, 🗺️, ⚠️, ❌ vào UI bản đồ, popup sân, nhãn loading hay thông báo lỗi.
3. ❌ **CẤM:** Sử dụng gradient tím/hồng/xanh lòe loẹt kiểu AI boilerplate (`from-purple-500 to-indigo-500`) trên các thanh trạng thái hoặc nút điều khiển bản đồ.
4. ❌ **CẤM:** Bo góc quá đà kiểu bong bóng (`rounded-3xl` hoặc `rounded-2xl` trên các thanh công cụ thanh mảnh).
5. ❌ **CẤM:** Overlay trắng đục che khuất toàn bộ giao diện khiến người dùng không thể thao tác các phần khác của trang.

### 5.2. Danh mục BẮT BUỘC thực thi (Required Guidelines)
1. ✅ **Màu sắc & Token:** Sử dụng màu Slate trung tính (`neutral-50` đến `neutral-900`) và xanh sân cỏ thương hiệu (`primary-600: #16a34a`, `primary-700: #15803d`). Viền bảng điều khiển bản đồ luôn là viền mỏng `1px solid var(--color-neutral-200)`.
2. ✅ **Đủ 6 trạng thái UI của bộ điều khiển bản đồ:**
   - **Default:** Nền trắng `neutral-0`, chữ `neutral-700`, viền `neutral-200`, đổ bóng mỏng `shadow-sm`.
   - **Hover:** Nền `neutral-100`, chữ `neutral-900`, hiệu ứng chuyển đổi `transition-colors duration-150`.
   - **Focus-visible:** Vòng sáng rõ nét `focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2`.
   - **Loading:** Thanh trạng thái mỏng nằm ở góc dưới bản đồ, vòng xoay SVG `Spinner size="xs"` màu `neutral-500`, nhãn tiếng Việt chuẩn: `"Đang tối ưu nguồn bản đồ…"`.
   - **Validation Error / Warning:** Thanh cảnh báo mỏng màu nền `bg-neutral-900/90` hoặc `bg-warning/10 border-warning/30`, chữ `text-neutral-900 text-xs`, có nút hành động `"Thử lại"` với icon Lucide `RefreshCw` kích thước 14px.
   - **Success / Stable:** Trạng thái ẩn thanh điều khiển sau 2 giây khi nguồn tile mới đã hoạt động ổn định, trả lại không gian thoáng đãng cho bản đồ.
3. ✅ **Trợ năng (Accessibility - a11y):** Các thông báo thay đổi nguồn tile phải mang thuộc tính `role="status"` và `aria-live="polite"` để phần mềm đọc màn hình (Screen Reader) thông báo nhẹ nhàng cho người khiếm thị mà không ngắt lời họ.

---

## 6. Kiến trúc Tệp & Danh sách Thay đổi Cụ thể

### 6.1. Tệp tạo mới

| Đường dẫn tệp | Trách nhiệm & Nội dung | Ước lượng |
|---|---|---|
| `apps/web/lib/map/tile-providers.ts` | Khai báo danh mục tile providers, logic lọc provider theo biến môi trường `NEXT_PUBLIC_*`, xác định thứ tự ưu tiên và provider mặc định. | ~130 dòng |
| `apps/web/lib/map/types.ts` | Định nghĩa toàn bộ TypeScript interfaces, types (`MapProviderId`, `TileProviderConfig`, `MapResilienceState`, `MapResilienceActions`). | ~70 dòng |
| `apps/web/lib/map/useTileResilience.ts` | Custom hook quản lý máy trạng thái đếm lỗi tile, cửa sổ trượt 3s, tự động chuyển provider và cung cấp API can thiệp thủ công. | ~140 dòng |
| `apps/web/components/features/venue/map/ResilientTileLayer.tsx` | Component Client bọc `TileLayer` của react-leaflet, tích hợp `useTileResilience`, lắng nghe sự kiện Leaflet `tileerror`/`tileload`. | ~120 dòng |
| `apps/web/components/features/venue/map/MapResilienceControl.tsx` | Thanh công cụ nhỏ góc bản đồ hiển thị trạng thái chuyển nguồn tile và nút "Thử lại" khi mất kết nối. | ~80 dòng |
| `apps/web/lib/map/tile-providers.test.ts` | Unit test kiểm tra danh mục provider, fallback order, lọc theo biến môi trường. | ~100 dòng |
| `apps/web/lib/map/useTileResilience.test.ts` | Unit test logic đếm lỗi, cửa sổ trượt, ngưỡng chuyển đổi với Vitest fake timers. | ~130 dòng |
| `apps/web/components/features/venue/map/ResilientTileLayer.test.tsx` | Widget test kiểm tra render với jsdom, lắng nghe sự kiện lỗi và cập nhật layer URL. | ~110 dòng |

### 6.2. Tệp cập nhật / Tái cấu trúc

| Đường dẫn tệp | Vị trí thay đổi & Giải pháp |
|---|---|
| `apps/web/components/features/venue/VenueMap.tsx` | Thay thế thẻ `<TileLayer />` dòng 126–129 bằng `<ResilientTileLayer />`. Nhúng `<MapResilienceControl />` bên trong `MapContainer`. Giữ nguyên toàn bộ logic Marker, Popup, BoundsUpdater hiện có. |
| `apps/web/components/features/venue/VenueLocationMap.tsx` | Thay thế thẻ `<TileLayer />` dòng 82–85 bằng `<ResilientTileLayer />`. Nhúng `<MapResilienceControl />` cho phép chủ sân luôn nhìn rõ vị trí chọn ghim toạ độ. |
| `apps/web/app/layout.tsx` | Bổ sung các thẻ `<link rel="preconnect" />` và `<link rel="dns-prefetch" />` cho các domain tile uy tín (`cartocdn.com`, `arcgisonline.com`). |
| `.env.example` | Bổ sung phần mẫu các biến môi trường bản đồ: `NEXT_PUBLIC_MAPTILER_API_KEY`, `NEXT_PUBLIC_STADIA_API_KEY`, `NEXT_PUBLIC_DEFAULT_MAP_PROVIDER`. |
| `apps/web/messages/vi.json` | Bổ sung nhóm từ khoá thông báo bản đồ trong mục `map`: `"reconnecting"`, `"providerSwitched"`, `"loadError"`, `"retryAction"`, `"allProvidersFailed"`. |

---

## 7. Chi tiết Hợp đồng Kỹ thuật & Cấu hình Chi tiết (`tile-providers.ts`)

Đặc tả mã mẫu TypeScript chuẩn mực để `senior-dev` hiện thực hoá trực tiếp:

```typescript
import type { TileProviderConfig, MapProviderId } from './types';

/** Fallback SVG Data URI nền Slate trung tính có lưới caro 32px mỏng */
export const FALLBACK_ERROR_TILE_URL =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="#f8fafc"/>
      <path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="128" cy="128" r="8" fill="#cbd5e1"/>
    </svg>`,
  );

/** Danh mục các Provider được hỗ trợ toàn diện */
export const TILE_PROVIDERS: Record<MapProviderId, TileProviderConfig> = {
  'carto-voyager': {
    id: 'carto-voyager',
    name: 'CARTO Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: false,
    priority: 1,
    supportsRetina: true,
  },
  'esri-world-street': {
    id: 'esri-world-street',
    name: 'Esri World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: false,
    priority: 2,
    supportsRetina: false,
  },
  'osm-france-hot': {
    id: 'osm-france-hot',
    name: 'OSM France Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank" rel="noopener noreferrer">HOT</a>',
    subdomains: ['a', 'b'],
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: false,
    priority: 3,
    supportsRetina: false,
  },
  opentopomap: {
    id: 'opentopomap',
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org" target="_blank" rel="noopener noreferrer">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a>',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 17,
    maxNativeZoom: 17,
    requiresKey: false,
    priority: 4,
    supportsRetina: false,
  },
  'osm-standard': {
    id: 'osm-standard',
    name: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: false,
    priority: 5,
    supportsRetina: false,
  },
  'maptiler-streets': {
    id: 'maptiler-streets',
    name: 'MapTiler Streets',
    url: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={apiKey}',
    attribution:
      '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 19,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_MAPTILER_API_KEY',
    priority: 0, // Đẩy lên ưu tiên cao nhất nếu được cung cấp key hợp lệ
    supportsRetina: true,
  },
  'stadia-smooth': {
    id: 'stadia-smooth',
    name: 'Stadia Alidade Smooth',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key={apiKey}',
    attribution:
      '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 20,
    maxNativeZoom: 18,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_STADIA_API_KEY',
    priority: 0,
    supportsRetina: true,
  },
  'geoapify-osm-bright': {
    id: 'geoapify-osm-bright',
    name: 'Geoapify OSM Bright',
    url: 'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={apiKey}',
    attribution:
      '&copy; <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_GEOAPIFY_API_KEY',
    priority: 0,
    supportsRetina: false,
  },
  'thunderforest-transport': {
    id: 'thunderforest-transport',
    name: 'Thunderforest Transport',
    url: 'https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apiKey}',
    attribution:
      '&copy; <a href="https://www.thunderforest.com/" target="_blank" rel="noopener noreferrer">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_THUNDERFOREST_API_KEY',
    priority: 0,
    supportsRetina: false,
  },
};
```

---

## 8. Ma trận Kiểm thử Toàn diện (Test Matrix for `auto-tester`)

Bộ tiêu chí kiểm thử bắt buộc `auto-tester` phải viết trong Vitest và chạy kiểm tra trực tiếp:

### 8.1. Unit Tests — Quản lý Provider (`lib/map/tile-providers.test.ts`)

| Mã Test | Mô tả kịch bản kiểm thử | Dữ liệu đầu vào / Điều kiện | Kết quả kỳ vọng |
|---|---|---|---|
| `UT-MAP-01` | Lọc danh sách provider mặc định khi không có bất kỳ API Key nào | `process.env` không có các key `NEXT_PUBLIC_*` | Chỉ trả về các provider `requiresKey: false`, xếp theo priority (CARTO → Esri → OSM-FR → OpenTopoMap → OSM-Standard). Không chứa MapTiler hay Stadia. |
| `UT-MAP-02` | Kích hoạt provider có API Key khi biến môi trường hợp lệ | Đặt `process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key-123'` | Provider `maptiler-streets` xuất hiện trong danh sách và được xếp ở vị trí ưu tiên số 1 (priority: 0). Mẫu URL được thay `{apiKey}` thành `test-key-123`. |
| `UT-MAP-03` | Bỏ qua provider có key khi giá trị rỗng hoặc chỉ có khoảng trắng | Đặt `NEXT_PUBLIC_STADIA_API_KEY = '   '` | Bỏ qua `stadia-smooth`, không đưa vào danh sách khả dụng để tránh request bị lỗi 401. |
| `UT-MAP-04` | Tôn trọng cấu hình `NEXT_PUBLIC_DEFAULT_MAP_PROVIDER` | Đặt biến môi trường trỏ về `esri-world-street` | `esri-world-street` được đưa lên đầu danh sách khả dụng bất kể thứ tự mặc định. |
| `UT-MAP-05` | Đảm bảo 100% provider có trường `attribution` hợp lệ và `maxNativeZoom` | Quét toàn bộ object `TILE_PROVIDERS` | Tất cả provider đều có chuỗi HTML ghi nhận bản quyền hợp lệ và `maxNativeZoom <= maxZoom`. |

### 8.2. Unit Tests — Hook Tự phục hồi (`lib/map/useTileResilience.test.ts`)

| Mã Test | Mô tả kịch bản kiểm thử | Điều kiện chạy (Dùng Fake Timers) | Kết quả kỳ vọng |
|---|---|---|---|
| `UT-RES-01` | Khởi tạo ban đầu với provider ưu tiên số 1 | Mới mount hook | `currentProviderIndex = 0`, `isSwitching = false`, `isAllFailed = false`, `errorCount = 0`. |
| `UT-RES-02` | Lỗi đơn lẻ dưới ngưỡng không kích hoạt chuyển provider | Gọi `reportTileError()` 3 lần trong vòng 1 giây (ngưỡng là 6) | `errorCount = 3`, `currentProviderIndex` vẫn giữ nguyên là 0. |
| `UT-RES-03` | Lỗi liên tiếp vượt ngưỡng kích hoạt chuyển sang provider kế tiếp | Gọi `reportTileError()` 6 lần liên tiếp trong 2 giây | `currentProviderIndex` nhảy từ 0 sang 1 (`esri-world-street`), `errorCount` được đặt lại 0, thông báo trạng thái cập nhật sang provider mới. |
| `UT-RES-04` | Xoá bộ đếm lỗi khi hết cửa sổ trượt thời gian | Gọi `reportTileError()` 4 lần, tua nhanh thời gian `vi.advanceTimersByTime(3500)` rồi gọi thêm 2 lần | Không kích hoạt chuyển đổi vì 4 lỗi trước đã hết hạn trong cửa sổ trượt 3s. |
| `UT-RES-05` | Duyệt hết toàn bộ provider thì chuyển sang cờ `isAllFailed` | Mô phỏng lỗi liên tục qua toàn bộ N provider khả dụng | `isAllFailed = true`, `statusMessage` thông báo không thể tải bản đồ, không lặp vô tận (chống switch loop). |
| `UT-RES-06` | Thao tác `retryFromStart()` khôi phục lại trạng thái ban đầu | Gọi `retryFromStart()` sau khi đã ở trạng thái `isAllFailed` | `currentProviderIndex` quay về 0, `isAllFailed = false`, `errorCount = 0`. |

### 8.3. Widget / Component Tests (`ResilientTileLayer.test.tsx`)

| Mã Test | Mô tả kịch bản | Môi trường kiểm thử | Kết quả kỳ vọng |
|---|---|---|---|
| `WT-MAP-01` | Render component trong môi trường DOM với leaflet mock | `// @vitest-environment jsdom` | Component render thẻ chứa `leaflet-layer`, không ném lỗi runtime. |
| `WT-MAP-02` | Thiết lập đúng các thuộc tính chống ô trắng cho Leaflet layer | Kiểm tra options truyền vào `L.tileLayer` | `keepBuffer = 4`, `updateWhenIdle = false`, `maxNativeZoom = 18`, `errorTileUrl` trỏ về SVG data URI. |
| `WT-MAP-03` | Bắt sự kiện `tileerror` trên DOM img của Leaflet | Kích hoạt sự kiện `error` giả lập trên phần tử tile | Hook ghi nhận và xử lý tăng bộ đếm lỗi mà không làm sập component. |
| `WT-MAP-04` | Render thanh điều khiển `MapResilienceControl` tuân thủ a11y | Render khi đang chuyển nguồn hoặc khi lỗi | Có `role="status"`, `aria-live="polite"`, chứa nút thử lại với `touch-target ≥ 44px`. |

### 8.4. Checklist Kiểm thử Thủ công (Manual QA Checklist)

1. [ ] **Chặn tên miền OSM (DNS Emulation):** Mở Chrome DevTools → Network request blocking → Chặn `*.tile.openstreetmap.org`. Mở trang `/venues`, chuyển sang tab Bản đồ: Bản đồ lập tức nạp tile từ CARTO Voyager mượt mà, 100% không xuất hiện ô trắng.
2. [ ] **Chặn tiếp tên miền CARTO (Failover Level 2):** Tiếp tục chặn `*.basemaps.cartocdn.com`. Quan sát bản đồ: Bản đồ tự động chuyển sang Esri ArcGIS World Street Map trong vòng < 250ms, hiển thị thông báo chuyển nguồn nhẹ nhàng dưới góc và tiếp tục tải đủ bản đồ.
3. [ ] **Mô phỏng ngắt mạng toàn phần (Offline):** Bật chế độ `Offline` trong DevTools Network: Bản đồ không hiện ô vuông rác, hiển thị tile hoa văn trung tính và thanh trạng thái "Không thể tải bản đồ. Kiểm tra lại kết nối mạng" kèm nút "Thử lại".
4. [ ] **Kiểm tra Zoom sâu mức 18–19 trên VenueDetail và VenueFormDialog:** Phóng to tối đa vào vị trí sân: Các chi tiết đường sá được nội suy mượt mà, không bị hiện tượng ô cờ trắng do thiếu tile mức 19.
5. [ ] **Kiểm tra Ghim toạ độ trong Dialog tạo sân của Owner:** Chọn ghim vị trí trong `VenueFormDialog.tsx`: Bản đồ tải ổn định, click ghim toạ độ nhạy bén, toạ độ vĩ độ/kinh độ được cập nhật chính xác.

---

## 9. Rủi ro, Giới hạn & Tuân thủ Bản quyền (Risks & Compliance)

| Nội dung | Rủi ro tiềm ẩn | Biện pháp giảm thiểu bắt buộc |
|---|---|---|
| **Chính sách sử dụng OSM (Fair-Use)** | Việc gửi hàng triệu request lên OSM gốc có thể bị khoá dải IP ứng dụng. | Đặt CARTO và Esri lên vị trí ưu tiên cao nhất, chỉ coi OSM là nguồn dự phòng thứ 4. |
| **Bản quyền & Attribution** | Vi phạm điều khoản dịch vụ nếu xoá dòng bản quyền của CARTO, Esri hoặc OpenStreetMap. | `ResilientTileLayer` tự động cập nhật chuỗi `attribution` tương ứng với provider đang hoạt động, giữ nguyên liên kết đến trang bản quyền. |
| **Google Maps ToS** | Sử dụng tile Google raster không qua Maps SDK có nguy cơ bị khiếu nại bản quyền. | **CẤM** đưa Google raster tiles vào danh sách hoạt động mặc định. Chỉ nêu trong tài liệu nhằm mục đích đối chiếu kỹ thuật. |
| **Vòng lặp chuyển nguồn (Switching Storm)** | Trong trường hợp mất mạng, các sự kiện lỗi tile có thể khiến component đổi provider liên tục gây nghẽn CPU. | Giới hạn số lần chuyển đổi: Mỗi provider chỉ được kích hoạt 1 lần trong một chu kỳ kiểm tra; nếu tất cả đều lỗi thì dừng lại ở trạng thái `isAllFailed` và chờ người dùng bấm "Thử lại". |

---

## 10. Các phần Ngoài phạm vi (Out of Scope)

Để đảm bảo tiến độ chuyển giao nhanh chóng, các hạng mục sau nằm ngoài phạm vi thực hiện của spec này:
- Không thay thế thư viện bản đồ cốt lõi (vẫn giữ Leaflet 1.9.4 và react-leaflet 4.2.1 theo đúng `package.json` và ADR-014).
- Không chuyển sang vector tiles (Mapbox GL JS / MapLibre) vì làm tăng bundle size và đòi hỏi cấu hình WebGL phức tạp.
- Không thay đổi cấu trúc dữ liệu trả về của backend API `/api/v1/venues/map`.

---

## 11. Định nghĩa Hoàn thành (Definition of Done - DoD)

Một PR triển khai `SPEC-MAP-002` chỉ được coi là đạt yêu cầu nghiệm thu khi thoả mãn đồng thời:
1. Có đầy đủ 5 tệp mới tại `apps/web/lib/map/` và `apps/web/components/features/venue/map/` theo đúng cấu trúc.
2. Hai component `VenueMap.tsx` và `VenueLocationMap.tsx` đã được thay thế `TileLayer` cũ bằng `ResilientTileLayer`.
3. 100% các ca kiểm thử trong Test Matrix được viết và vượt qua: `pnpm --filter @bsc/web test` đạt **PASS 100%**.
4. Chạy `pnpm typecheck` và `pnpm lint` không phát sinh bất kỳ lỗi hoặc cảnh báo nào.
5. Không xuất hiện bất kỳ ô vuông màu trắng nào khi kiểm thử chặn tên miền `tile.openstreetmap.org`.
6. Tuân thủ 100% quy tắc Anti-AI Design (không emoji, không gradient neon, viền Slate 1px mỏng, đủ 6 trạng thái UI).

---

`STATUS: DONE`

**Danh sách tệp tài liệu đặc tả đã tạo:**
- `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\docs\specs\map-tile-resilience-spec.md`
