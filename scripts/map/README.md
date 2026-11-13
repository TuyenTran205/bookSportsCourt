# Hướng dẫn tạo và host bản đồ Việt Nam `vietnam.pmtiles` trên Cloudflare R2 (ADR-031)

## 1. Cắt file `vietnam.pmtiles` (~280–600 MB)

1. Tải CLI `go-pmtiles` tại https://github.com/protomaps/go-pmtiles/releases/latest và giải nén vào `PATH`.
2. Chạy script PowerShell từ thư mục gốc repo:
   ```powershell
   .\scripts\map\build-vietnam-pmtiles.ps1 -MaxZoom 14 -OutputFile ".\.tmp\vietnam.pmtiles"
   ```
   *(Script dùng `vietnam-extract-region.geojson` cắt riêng đất liền Việt Nam, Quần đảo Hoàng Sa và Quần đảo Trường Sa).*

## 2. Upload PMTiles & Font tiếng Việt (.pbf) lên Cloudflare R2

Với tài khoản R2 đã cấu hình sẵn trong `.env.local`:
```powershell
node .\scripts\map\upload-r2-pmtiles.mjs .\.tmp\vietnam.pmtiles map/vietnam.pmtiles
node .\scripts\map\upload-r2-fonts.mjs
```
Script tự động cấu hình CORS (hỗ trợ `Range`, `Content-Range`, `Accept-Ranges` cho HTTP 206), upload file PMTiles + bộ font `Noto Sans` tiếng Việt lên bucket R2 và kiểm tra truy cập thành công.

## 3. Gắn Custom Domain (khuyên dùng) & Bật trên Frontend (`@bsc/web`)

1. Trên Cloudflare Dashboard → R2 → Bucket `booksportscourt` → **Custom Domains**, gắn domain riêng (ví dụ `map.booksportscourt.id.vn`) để Cloudflare Edge Cache phục vụ nhanh tại Việt Nam hơn `pub-*.r2.dev`.
2. Thêm biến môi trường vào `.env.local` và **Vercel Environment Variables**:
   ```env
   NEXT_PUBLIC_VIETNAM_PMTILES_URL=https://map.booksportscourt.id.vn/map/vietnam.pmtiles
   NEXT_PUBLIC_MAP_GLYPHS_URL=https://map.booksportscourt.id.vn/map/fonts/{fontstack}/{range}.pbf
   ```
   *(Nếu không đặt `NEXT_PUBLIC_MAP_GLYPHS_URL`, ứng dụng mặc định nạp font từ CDN Protomaps miễn phí).*
Khi `NEXT_PUBLIC_VIETNAM_PMTILES_URL` được đặt, MapLibre GL JS tự động dùng bản đồ Việt Nam tự decor làm nguồn ưu tiên số 1, đồng thời giữ Esri / OSM làm fallback tự động nếu mất kết nối R2.
