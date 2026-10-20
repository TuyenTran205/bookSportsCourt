# ĐẶC TẢ KỸ THUẬT: KHẮC PHỤC TRIỆT ĐỂ LỖI WATERMARK BẢN ĐỒ VÀ TÁI CẤU TRÚC NHÀ CUNG CẤP TILE (MAP TILE PROVIDER FIX)

- **Mã tài liệu:** `SPEC-MAP-003` (Addendum A cho `SPEC-MAP-002`)
- **Phiên bản:** `1.0.0`
- **Tác giả:** Product Architect & UX Specifier (`9router_BA`)
- **Trạng thái:** APPROVED / Sẵn sàng chuyển giao cho `senior-dev`
- **Dự án:** BookSportsCourt (Next.js 14.2 App Router · react-leaflet 4.2 · leaflet 1.9 · TypeScript Strict)
- **Tài liệu căn cứ:**
  - `AGENTS.md` (10 quy tắc tối thượng, quy tắc token, cấm emoji, đủ 6 trạng thái UI)
  - `docs/07-design-system.md` (bảng màu neutral Slate, primary sân cỏ, border radius token)
  - `docs/08-ui-quality-rules.md` (tiêu chuẩn Anti-AI Design, kiểm tra AA, cấm gradient neon)
  - `docs/specs/map-tile-resilience-spec.md` (`SPEC-MAP-002` - Kiến trúc phục hồi tile)
  - `docs/18-decision-log.md` (ADR-014: Leaflet + OpenStreetMap thay Google Maps)

---

## 1. Bối cảnh & Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)

### 1.1. Hiện tượng thực tế trên môi trường chạy
Khi người dùng truy cập trang tìm kiếm sân `/venues` (`http://localhost:3000/venues`) hoặc xem bản đồ vị trí sân tại `/venues/[slug]`:
- Toàn bộ các ô tile nền bản đồ xuất hiện các dòng chữ watermark chéo lặp lại:
  ```text
  "API KEY REQUIRED"
  "carto.com/basemaps/apikey"
  ```
- Nằm đè lên trên lớp watermark là các ghim đánh dấu sân (pin marker xanh thể thao `#16a34a` / `#15803d`).
- Giao diện bị suy giảm nghiêm trọng về mặt thẩm mỹ, vi phạm tiêu chuẩn sản phẩm lớn (Anti-AI Design) và gây cảm giác ứng dụng chưa hoàn thiện hoặc chưa thanh toán dịch vụ bản đồ.

---

### 1.2. Phân tích Kỹ thuật Chuyên sâu: Cạm bẫy "HTTP 200 Silent Watermark" (The Pitfall)

Hệ thống đã có cơ chế tự phục hồi tile (`SPEC-MAP-002` qua `ResilientTileLayer` và `useTileResilience`) với sliding window đếm 6 lỗi trong 3.000ms để tự động đổi nguồn tile dự phòng. Tuy nhiên, cơ chế này hoàn toàn **bị vô hiệu hóa** trước cách thức trả dữ liệu mới của CARTO:

```
[Trình duyệt gửi request tile không kèm API key]
   GET https://a.basemaps.cartocdn.com/rastertiles/voyager/13/6638/3884.png
                     │
                     ▼
[Chính sách mới của CARTO (carto.com/basemaps/apikey)]
   CARTO KHÔNG trả về HTTP 401 Unauthorized
   CARTO KHÔNG trả về HTTP 403 Forbidden
   CARTO TRẢ VỀ:
     - HTTP Status: 200 OK
     - Content-Type: image/png
     - Content-Length: 2,049 bytes
     - Body: Ảnh raster PNG 256x256 chứa watermark "API KEY REQUIRED"
                     │
                     ▼
[Leaflet & DOM Image Event]
   - Thẻ <img class="leaflet-tile"> nhận HTTP 200 và ảnh PNG hợp lệ.
   - Sự kiện HTMLImageElement.onerror KHÔNG BAO GIỜ kích hoạt!
   - Sự kiện HTMLImageElement.onload kích hoạt bình thường!
   - Leaflet kích hoạt sự kiện: layer.fire('tileload')
                     │
                     ▼
[Hệ quả đối với Lớp phòng thủ useTileResilience]
   - Hook useTileResilience nhận sự kiện 'tile-load'.
   - Reducer hiểu rằng tile đang tải thành công 100%.
   - errorTimestamps bị xóa/giảm trừ.
   - isDegraded không bao giờ = true, switchProvider không bao giờ được gọi.
   - Bản đồ bị kẹt vĩnh viễn ở CARTO kèm watermark "API KEY REQUIRED"!
```

### 1.3. Khuyết tật Cấu hình trong Codebase Hiện tại
1. `apps/web/lib/map/tile-providers.ts` (dòng 17–30):
   ```typescript
   'carto-voyager': {
     id: 'carto-voyager',
     name: 'CARTO Voyager',
     requiresKey: false, // <-- SAI THỰC TẾ: CARTO hiện tại bắt buộc phải có key
     priority: 1,        // <-- Đang được xếp làm ưu tiên số 1 khi không có key
     ...
   }
   ```
2. `apps/web/components/features/venue/map/ResilientTileLayer.tsx` (dòng 164):
   ```typescript
   export const DEFAULT_MAP_PROVIDER: TileProviderConfig = TILE_PROVIDERS['carto-voyager'];
   ```
3. `apps/web/lib/map/useTileResilience.ts` (dòng 184 & 203):
   Fallback mặc định khi danh sách rỗng vẫn trỏ về `TILE_PROVIDERS['carto-voyager']`.
4. `apps/web/app/layout.tsx` (dòng 53–54):
   Đang ưu tiên preconnect đến `basemaps.cartocdn.com` thay vì hạ tầng miễn phí sẵn sàng phục vụ.

---

## 2. Giải pháp Kiến trúc & Tái cấu trúc Hệ thống Provider

Thiết lập phân tầng Provider thành 2 nhóm rõ rệt:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TỔNG HỢP PROVIDERS                              │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐
│ TIER 1: NHÓM MIỄN PHÍ 100%           │    │ TIER 2: NHÓM CÓ API KEY              │
│ (requiresKey: false)                 │    │ (requiresKey: true, priority: 0)     │
│ Hoạt động ngay, 0đ, không watermark  │    │ Chỉ kích hoạt khi có Key hợp lệ      │
├──────────────────────────────────────┤    ├──────────────────────────────────────┤
│ 1. esri-world-street (Priority: 1)   │    │ 1. carto-voyager                     │
│    ArcGIS World Street Map           │    │    (NEXT_PUBLIC_CARTO_API_KEY)       │
│    Ổn định, chi tiết, tiếng Việt     │    │                                      │
│                                      │    │ 2. maptiler-streets                  │
│ 2. osm-france-hot (Priority: 2)      │    │    (NEXT_PUBLIC_MAPTILER_API_KEY)    │
│    OSM Nhân đạo Châu Âu              │    │                                      │
│    Độ tương phản cao                 │    │ 3. stadia-smooth                     │
│                                      │    │    (NEXT_PUBLIC_STADIA_API_KEY)      │
│ 3. opentopomap (Priority: 3)         │    │                                      │
│    Bản đồ địa hình                   │    │ 4. geoapify-osm-bright               │
│                                      │    │    (NEXT_PUBLIC_GEOAPIFY_API_KEY)    │
│ 4. osm-standard (Priority: 4)        │    │                                      │
│    OpenStreetMap cộng đồng           │    │ 5. thunderforest-transport           │
│                                      │    │    (NEXT_PUBLIC_THUNDERFOREST_API_KEY│
└──────────────────────────────────────┘    └──────────────────────────────────────┘
```

### 2.1. Nhóm Miễn phí 100% Không Cần Key (No-Key Group)

| Thứ tự | Provider ID | Tên hiển thị | URL Template | Ưu điểm & Đặc tính kỹ thuật |
|---|---|---|---|---|
| **Ưu tiên 1 (Mặc định)** | `esri-world-street` | Esri World Street Map | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}` | **Không watermark, miễn phí 100%**. CDN ArcGIS (Akamai/AWS) cực kỳ mạnh mẽ và ổn định tại Việt Nam. Địa danh và tên đường tiếng Việt đầy đủ, chuẩn xác, màu sắc thanh nhã phù hợp hoàn hảo với ghim xanh sân cỏ. |
| **Ưu tiên 2** | `osm-france-hot` | OSM France Humanitarian | `https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png` (subdomains: `['a', 'b']`) | Miễn phí từ tổ chức OSM Pháp / Humanitarian OpenStreetMap Team. Không watermark, độ tương phản cao, hạ tầng máy chủ châu Âu độc lập. |
| **Ưu tiên 3** | `opentopomap` | OpenTopoMap | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` (subdomains: `['a', 'b', 'c']`) | Bản đồ địa hình mã nguồn mở, không watermark, maxZoom 17 (co phóng nội suy). |
| **Ưu tiên 4** | `osm-standard` | OpenStreetMap Standard | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (subdomains: `['a', 'b', 'c']`) | Máy chủ cộng đồng OSM, đóng vai trò cứu cánh cuối cùng trong nhóm miễn phí. |

---

### 2.2. Nhóm Yêu cầu API Key (Keyed Group - Đẩy lên Priority: 0 khi có Key)

| Provider ID | Tên biến môi trường | URL Template có gắn Key | Hành vi khi thiếu / có key |
|---|---|---|---|
| `carto-voyager` | `NEXT_PUBLIC_CARTO_API_KEY` | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key={apiKey}` | **requiresKey: true**. Khi không có key: tự động loại khỏi danh sách (tránh 100% vấn đề watermark). Khi có key: đưa lên priority 0 (hoặc vị trí đầu). |
| `maptiler-streets` | `NEXT_PUBLIC_MAPTILER_API_KEY` | `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={apiKey}` | `requiresKey: true`. Kích hoạt khi có key, priority 0. |
| `stadia-smooth` | `NEXT_PUBLIC_STADIA_API_KEY` | `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key={apiKey}` | `requiresKey: true`. Kích hoạt khi có key, priority 0. |
| `geoapify-osm-bright` | `NEXT_PUBLIC_GEOAPIFY_API_KEY` | `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={apiKey}` | `requiresKey: true`. Kích hoạt khi có key, priority 0. |
| `thunderforest-transport` | `NEXT_PUBLIC_THUNDERFOREST_API_KEY` | `https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apiKey}` | `requiresKey: true`. Kích hoạt khi có key, priority 0. |

---

## 3. Danh sách File Cần Tạo / Sửa Đổi Cụ Thể

### 3.1. Danh sách file và trách nhiệm

| STT | Đường dẫn tuyệt đối | Hành động | Trách nhiệm chi tiết |
|---|---|---|---|
| 1 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\lib\map\tile-providers.ts` | **SỬA** | - Chuyển `carto-voyager` sang `requiresKey: true`, `keyEnvVar: 'NEXT_PUBLIC_CARTO_API_KEY'`, priority: 0, URL thêm `?key={apiKey}`.<br>- Cập nhật priority nhóm no-key: `esri-world-street`: 1, `osm-france-hot`: 2, `opentopomap`: 3, `osm-standard`: 4.<br>- Thêm `NEXT_PUBLIC_CARTO_API_KEY` vào `MapEnvConfig`, `readStaticEnv()`, và logic phân giải key trong `getTileProviders()`. |
| 2 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\components\features\venue\map\ResilientTileLayer.tsx` | **SỬA** | Cập nhật hằng số `DEFAULT_MAP_PROVIDER` trỏ sang `TILE_PROVIDERS['esri-world-street']`. |
| 3 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\lib\map\useTileResilience.ts` | **SỬA** | Cập nhật 2 chỗ fallback mặc định khi không tìm thấy provider khả dụng trỏ sang `TILE_PROVIDERS['esri-world-street']`. |
| 4 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\app\layout.tsx` | **SỬA** | Đưa `<link rel="preconnect" href="https://server.arcgisonline.com" crossOrigin="anonymous" />` lên vị trí đầu tiên trong `<head>`. |
| 5 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\.env.example` | **SỬA** | Bổ sung biến `NEXT_PUBLIC_CARTO_API_KEY=` vào mục cấu hình bản đồ. |
| 6 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\.env.example` | **TẠO/SỬA** | Đảm bảo có file mẫu môi trường phía web chứa đầy đủ các biến tile providers. |
| 7 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\lib\map\tile-providers.test.ts` | **SỬA** | Cập nhật bộ unit test `UT-MAP-01` đến `UT-MAP-06` phản ánh đúng cấu trúc ưu tiên mới (Esri #1, CARTO cần key). |
| 8 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\lib\map\useTileResilience.test.ts` | **SỬA** | Cập nhật các kỳ vọng provider khởi đầu là `esri-world-street` và provider chuyển tiếp khi lỗi là `osm-france-hot`. |
| 9 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\components\features\venue\map\ResilientTileLayer.test.tsx` | **SỬA** | Cập nhật kỳ vọng URL layer đầu tiên là Esri và layer sau 6 lỗi là OSM France HOT. |
| 10 | `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt\apps\web\components\features\venue\map\MapResilienceControl.test.tsx` | **SỬA** | Cập nhật mock activeProvider nếu cần sang `esri-world-street`. |

---

## 4. Chi tiết Kỹ thuật Từng File Dành cho `senior-dev`

### 4.1. `apps/web/lib/map/tile-providers.ts`

```typescript
// Cấu hình mới cho carto-voyager:
'carto-voyager': {
  id: 'carto-voyager',
  name: 'CARTO Voyager',
  label: 'CARTO Voyager',
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key={apiKey}',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
  subdomains: ['a', 'b', 'c', 'd'],
  maxZoom: 19,
  maxNativeZoom: 18,
  requiresKey: true, // <-- BẮT BUỘC ĐỔI THÀNH TRUE
  keyEnvVar: 'NEXT_PUBLIC_CARTO_API_KEY', // <-- BỔ SUNG BIẾN MÔI TRƯỜNG
  priority: 0, // Khi có key thì ưu tiên cao nhất
  supportsRetina: true,
},

// Cấu hình mới cho esri-world-street:
'esri-world-street': {
  id: 'esri-world-street',
  name: 'Esri World Street Map',
  label: 'Esri World Street Map',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution:
    '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
  maxZoom: 19,
  maxNativeZoom: 18,
  requiresKey: false,
  priority: 1, // <-- ĐỔI THÀNH 1 (MẶC ĐỊNH ĐẦU TIÊN KHI KHÔNG CÓ KEY)
  supportsRetina: false,
},

// Cấu hình mới cho osm-france-hot:
'osm-france-hot': {
  ...
  priority: 2, // <-- ĐỔI THÀNH 2
},

// Cấu hình mới cho opentopomap:
opentopomap: {
  ...
  priority: 3, // <-- ĐỔI THÀNH 3
},

// Cấu hình mới cho osm-standard:
'osm-standard': {
  ...
  priority: 4, // <-- ĐỔI THÀNH 4
},
```

```typescript
// Mở rộng MapEnvConfig:
export interface MapEnvConfig {
  NEXT_PUBLIC_CARTO_API_KEY?: string; // <-- THÊM MỚI
  NEXT_PUBLIC_MAPTILER_API_KEY?: string;
  NEXT_PUBLIC_STADIA_API_KEY?: string;
  NEXT_PUBLIC_GEOAPIFY_API_KEY?: string;
  NEXT_PUBLIC_THUNDERFOREST_API_KEY?: string;
  NEXT_PUBLIC_DEFAULT_MAP_PROVIDER?: string;
}

// Cập nhật readStaticEnv():
function readStaticEnv(): MapEnvConfig {
  return {
    NEXT_PUBLIC_CARTO_API_KEY: process.env.NEXT_PUBLIC_CARTO_API_KEY, // <-- THÊM MỚI
    NEXT_PUBLIC_MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY,
    NEXT_PUBLIC_STADIA_API_KEY: process.env.NEXT_PUBLIC_STADIA_API_KEY,
    NEXT_PUBLIC_GEOAPIFY_API_KEY: process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
    NEXT_PUBLIC_THUNDERFOREST_API_KEY: process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY,
    NEXT_PUBLIC_DEFAULT_MAP_PROVIDER: process.env.NEXT_PUBLIC_DEFAULT_MAP_PROVIDER,
  };
}

// Trong getTileProviders():
if (provider.keyEnvVar === 'NEXT_PUBLIC_CARTO_API_KEY') {
  rawKey = env.NEXT_PUBLIC_CARTO_API_KEY;
} else if (provider.keyEnvVar === 'NEXT_PUBLIC_MAPTILER_API_KEY') {
...
```

### 4.2. `apps/web/components/features/venue/map/ResilientTileLayer.tsx`
Thay đổi dòng 164:
```typescript
/** Provider mặc định dùng khi không xác định được nguồn nào khả dụng */
export const DEFAULT_MAP_PROVIDER: TileProviderConfig = TILE_PROVIDERS['esri-world-street'];
```

### 4.3. `apps/web/lib/map/useTileResilience.ts`
Thay đổi dòng 184 và 203:
```typescript
// Dòng 184:
const detected = getTileProviders();
return detected.length > 0 ? detected : [TILE_PROVIDERS['esri-world-street']];

// Dòng 203:
const activeProvider = availableProviders[safeIndex] ?? TILE_PROVIDERS['esri-world-street'];
```

### 4.4. `apps/web/app/layout.tsx`
Cập nhật thứ tự kết nối sớm mạng (preconnect/dns-prefetch):
```html
<head>
  {/* Tối ưu kết nối trước đến CDN Tile của Bản đồ (Ưu tiên Esri mặc định) */}
  <link rel="preconnect" href="https://server.arcgisonline.com" crossOrigin="anonymous" />
  <link rel="preconnect" href="https://a.tile.openstreetmap.fr" crossOrigin="anonymous" />
  <link rel="dns-prefetch" href="https://tile.opentopomap.org" />
  <link rel="dns-prefetch" href="https://a.basemaps.cartocdn.com" />
</head>
```

### 4.5. `.env.example` và `apps/web/.env.example`
Bổ sung:
```bash
# ── Bản đồ: Nguồn tile dự phòng (SPEC-MAP-003) ─────────────────────────────
# CARTO basemaps hiện yêu cầu key để không hiện watermark "API KEY REQUIRED"
# Lấy miễn phí tại: https://carto.com/basemaps/apikey
NEXT_PUBLIC_CARTO_API_KEY=
NEXT_PUBLIC_MAPTILER_API_KEY=
NEXT_PUBLIC_STADIA_API_KEY=
NEXT_PUBLIC_GEOAPIFY_API_KEY=
NEXT_PUBLIC_THUNDERFOREST_API_KEY=
# Provider mặc định muốn ưu tiên (esri-world-street | carto-voyager | maptiler-streets ...)
NEXT_PUBLIC_DEFAULT_MAP_PROVIDER=esri-world-street
```

---

## 5. Tiêu chuẩn Thiết kế Anti-AI Design (Trang Lớn Linear / Stripe)

Tuân thủ nghiêm ngặt 10 quy tắc `AGENTS.md` và `docs/08-ui-quality-rules.md`:

1. **Tuyệt đối không dùng alert popup cổ điển:** Mọi sự cố bản đồ chỉ thể hiện qua thanh điều khiển tinh tế góc dưới (`MapResilienceControl`) hoặc nền Slate trung tính chống ô trắng (`FALLBACK_ERROR_TILE_URL`).
2. **Không dùng emoji rác (🚀, ✨, 🗺️, ⚠️) trong UI bản đồ:** Icon duy nhất được phép dùng là các icon Lucide với kích thước chuẩn xác (`Check size={14}`, `Loader2 size={14}`, `RefreshCw size={14}`).
3. **Màu sắc thanh nhã chuẩn Stripe / Vercel:**
   - Bản đồ `esri-world-street` có tông màu xám nhẹ, đường phố màu trắng ngà và công viên xanh nhạt, tôn rõ điểm ghim giá tiền sân cỏ `bg-primary-600: #16a34a` (và `#15803d` khi được chọn).
   - Thanh điều khiển: Nền trắng `bg-white`, viền mỏng `border border-neutral-200`, bo góc chuẩn `rounded-md` (không dùng bong bóng `rounded-3xl`), bóng đổ nhẹ `shadow-sm`.
4. **Đủ 6 trạng thái UI của bộ điều khiển bản đồ:**
   - `Default`: Ẩn khi tile tải ổn định.
   - `Loading`: Hiện sau 600ms với nhãn `"Đang tải bản đồ…"`.
   - `Degraded / Switching`: Vòng xoay mỏng nhẹ, thông báo `"Đang chuyển sang nguồn bản đồ dự phòng…"`.
   - `Recovered / Success`: Icon tích xanh `Check` màu `primary-600`, hiện tên nguồn mới 2 giây rồi tự ẩn.
   - `Failed`: Toàn bộ nguồn thất bại, hiện nhãn `"Không thể tải bản đồ"` và nút `"Thử lại"`.
   - `Focus-visible / Active`: Nút Thử lại có `focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2`, vùng bấm chuẩn `min-h-11 min-w-11`.

---

## 6. Ma trận Kiểm thử Toàn diện (Test Matrix for `auto-tester`)

Yêu cầu `auto-tester` kiểm tra và thực thi 100% test cases dưới đây thông qua Vitest:

### 6.1. Unit Test Suite: `tile-providers.test.ts`

```text
Test Suite: apps/web/lib/map/tile-providers.test.ts (SPEC-MAP-003)
├── UT-MAP-01: Lọc danh sách provider mặc định khi không có bất kỳ API Key nào
│   ├── KỲ VỌNG: Danh sách trả về đúng 4 provider (không có CARTO Voyager vì requiresKey: true).
│   ├── KỲ VỌNG: Thứ tự ID chính xác là:
│   │   ['esri-world-street', 'osm-france-hot', 'opentopomap', 'osm-standard']
│   └── KỲ VỌNG: 100% provider trong danh sách có requiresKey === false.
│
├── UT-MAP-02: Kích hoạt CARTO Voyager khi cung cấp NEXT_PUBLIC_CARTO_API_KEY
│   ├── ĐIỀU KIỆN: NEXT_PUBLIC_CARTO_API_KEY = 'carto-secret-test-key'
│   ├── KỲ VỌNG: Danh sách có 5 provider.
│   ├── KỲ VỌNG: carto-voyager đứng ở vị trí đầu tiên (index 0, priority: 0).
│   └── KỲ VỌNG: URL của carto-voyager chứa ?key=carto-secret-test-key, không còn placeholder {apiKey}.
│
├── UT-MAP-03: Kích hoạt MapTiler Streets khi cung cấp NEXT_PUBLIC_MAPTILER_API_KEY
│   ├── ĐIỀU KIỆN: NEXT_PUBLIC_MAPTILER_API_KEY = 'maptiler-secret-test-key'
│   ├── KỲ VỌNG: Danh sách có 5 provider.
│   ├── KỲ VỌNG: maptiler-streets đứng ở vị trí đầu tiên (index 0, priority: 0).
│   └── KỲ VỌNG: URL chứa key=maptiler-secret-test-key.
│
├── UT-MAP-04: Xử lý nhiều API Key và loại bỏ key rỗng / khoảng trắng
│   ├── ĐIỀU KIỆN: CARTO key = '   ' (khoảng trắng), MapTiler key = 'valid-key'
│   ├── KỲ VỌNG: carto-voyager bị loại bỏ hoàn toàn (không đưa vào để tránh 401/watermark).
│   └── KỲ VỌNG: maptiler-streets được kích hoạt bình thường.
│
├── UT-MAP-05: Tôn trọng NEXT_PUBLIC_DEFAULT_MAP_PROVIDER
│   ├── ĐIỀU KIỆN: NEXT_PUBLIC_DEFAULT_MAP_PROVIDER = 'osm-france-hot'
│   ├── KỲ VỌNG: osm-france-hot được đưa lên vị trí đầu tiên (index 0).
│   └── KỲ VỌNG: Các provider khác giữ nguyên tính khả dụng.
│
└── UT-MAP-06: Kiểm tra tính toàn vẹn và hợp lệ của toàn bộ TILE_PROVIDERS
    ├── KỲ VỌNG: 100% provider có attribution hợp lệ độ dài > 10 ký tự.
    ├── KỲ VỌNG: 100% provider có maxNativeZoom <= maxZoom.
    └── KỲ VỌNG: FALLBACK_ERROR_TILE_URL là SVG Data URI hợp lệ, nền #f8fafc Slate, dung lượng < 400 bytes.
```

### 6.2. Unit Test Suite: `useTileResilience.test.ts`

```text
Test Suite: apps/web/lib/map/useTileResilience.test.ts (SPEC-MAP-003)
├── UT-RES-01: Khởi tạo mặc định không key
│   └── KỲ VỌNG: activeProvider.id === 'esri-world-street', providerIndex === 0.
│
├── UT-RES-02: 6 lỗi liên tiếp kích hoạt chuyển sang provider kế tiếp
│   └── KỲ VỌNG: activeProvider.id chuyển từ 'esri-world-street' sang 'osm-france-hot' (providerIndex === 1).
│
└── UT-RES-03: Thử lại từ đầu (retryFromStart)
    └── KỲ VỌNG: Quay trở lại 'esri-world-street' (providerIndex === 0).
```

### 6.3. Component / Widget Test Suite: `ResilientTileLayer.test.tsx`

```text
Test Suite: apps/web/components/features/venue/map/ResilientTileLayer.test.tsx (SPEC-MAP-003)
├── WT-MAP-01: L.tileLayer khởi tạo với URL của esri-world-street
│   └── KỲ VỌNG: activeLayerRecords[0].url === TILE_PROVIDERS['esri-world-street'].url.
│
└── WT-MAP-02: 6 sự kiện tileerror kích hoạt chuyển sang osm-france-hot
    └── KỲ VỌNG: activeLayerRecords[1].url === TILE_PROVIDERS['osm-france-hot'].url.
```

---

## 7. Checklist Nghiệm thu (Definition of Done - DoD)

Một PR được xem là hoàn tất khi thoả mãn đồng thời:

1. [ ] Đã cập nhật `apps/web/lib/map/tile-providers.ts` chuyển `carto-voyager` sang `requiresKey: true` và `esri-world-street` làm ưu tiên #1.
2. [ ] Đã cập nhật `DEFAULT_MAP_PROVIDER` trong `ResilientTileLayer.tsx` và fallback trong `useTileResilience.ts` sang `esri-world-street`.
3. [ ] Đã cập nhật `apps/web/app/layout.tsx` preconnect ưu tiên `server.arcgisonline.com`.
4. [ ] Đã thêm `NEXT_PUBLIC_CARTO_API_KEY` vào `.env.example` và `apps/web/.env.example`.
5. [ ] Bộ test Vitest: `pnpm --filter @bsc/web test` vượt qua **100% PASS** (cả `tile-providers.test.ts`, `useTileResilience.test.ts`, `ResilientTileLayer.test.tsx`).
6. [ ] Kiểm tra tĩnh: `pnpm typecheck` và `pnpm lint` không có bất kỳ lỗi nào.
7. [ ] Trực quan: Mở trang `/venues` (`http://localhost:3000/venues`), bản đồ nạp mượt mà từ Esri ArcGIS, tuyệt đối **KHÔNG CÒN WATERMARK "API KEY REQUIRED"**, các pin marker sân xanh thể thao hiển thị sắc nét.
8. [ ] Tuân thủ nghiêm ngặt chuẩn Anti-AI Design (không emoji rác, không gradient neon, viền mỏng 1px Slate, đủ 6 trạng thái UI).

---

`STATUS: SPEC_APPROVED`
*Tài liệu đã hoàn tất và sẵn sàng để chuyển giao cho Senior Dev (`senior-dev`) thực thi.*
