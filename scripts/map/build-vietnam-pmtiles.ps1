<#
.SYNOPSIS
Cắt bản đồ Vector Tiles (PMTiles) toàn lãnh thổ Việt Nam (bao gồm Biển Đông, Hoàng Sa, Trường Sa)
từ bộ build mới nhất của Protomaps để upload lên Cloudflare R2 (ADR-030).

.EXAMPLE
.\scripts\map\build-vietnam-pmtiles.ps1 -MaxZoom 15 -OutputFile ".\tmp\vietnam.pmtiles"
#>

param(
  [int]$MaxZoom = 14,
  [string]$OutputFile = ".\.tmp\vietnam.pmtiles",
  [string]$BuildDate = ""
)

$ErrorActionPreference = "Stop"

# Region GeoJSON bao gồm đất liền Việt Nam + Biển Đông + Hoàng Sa + Trường Sa (tránh kéo dữ liệu nước ngoài)
$RegionFile = Join-Path $PSScriptRoot "vietnam-extract-region.geojson"
$VietnamBBox = "102.0,6.5,118.0,23.5"

$pmtilesCmd = Get-Command "pmtiles" -ErrorAction SilentlyContinue
if (-not $pmtilesCmd) {
  Write-Host "Chưa cài công cụ 'pmtiles' CLI." -ForegroundColor Yellow
  Write-Host "Hãy tải file thực thi go-pmtiles (Windows zip) tại:" -ForegroundColor Cyan
  Write-Host "  https://github.com/protomaps/go-pmtiles/releases/latest"
  Write-Host "Giải nén và thêm thư mục chứa pmtiles.exe vào PATH rồi chạy lại script."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($BuildDate)) {
  # Thử lùi 2 ngày so với hôm nay để chắc chắn Protomaps daily build đã phát hành
  $BuildDate = (Get-Date).AddDays(-2).ToString("yyyyMMdd")
}

$SourceUrl = "https://build.protomaps.com/$BuildDate.pmtiles"
$OutputDir = Split-Path -Parent $OutputFile
if (-not [string]::IsNullOrWhiteSpace($OutputDir) -and -not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

if (Test-Path $RegionFile) {
  Write-Host "Đang trích xuất bản đồ Việt Nam theo region ($RegionFile, maxzoom: $MaxZoom)..." -ForegroundColor Green
  Write-Host "Nguồn: $SourceUrl" -ForegroundColor DarkGray
  Write-Host "Đích:  $OutputFile" -ForegroundColor DarkGray
  & pmtiles extract $SourceUrl $OutputFile "--region=$RegionFile" "--maxzoom=$MaxZoom" "--download-threads=4"
} else {
  Write-Host "Đang trích xuất bản đồ Việt Nam (bbox: $VietnamBBox, maxzoom: $MaxZoom)..." -ForegroundColor Green
  Write-Host "Nguồn: $SourceUrl" -ForegroundColor DarkGray
  Write-Host "Đích:  $OutputFile" -ForegroundColor DarkGray
  & pmtiles extract $SourceUrl $OutputFile "--bbox=$VietnamBBox" "--maxzoom=$MaxZoom" "--download-threads=4"
}

if ($LASTEXITCODE -ne 0) {
  throw "Lệnh pmtiles extract thất bại với mã lỗi $LASTEXITCODE. Hãy thử truyền -BuildDate YYYYMMDD khác."
}

Write-Host "`nKiểm tra metadata file PMTiles vừa tạo:" -ForegroundColor Green
& pmtiles show $OutputFile

Write-Host "`nHoàn tất! Bước tiếp theo: Upload $OutputFile lên Cloudflare R2 bucket và đặt biến NEXT_PUBLIC_VIETNAM_PMTILES_URL." -ForegroundColor Cyan
