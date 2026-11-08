import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PROVINCES } from "../../../../../packages/shared/src/data/provinces.js";
import type { District, Province, Ward } from "../../../../../packages/shared/src/types.js";
import { matchUnaccent } from "../../../../../packages/shared/src/utils/unaccent.js";
import { loadWards } from "./wards-data.js";

/** Giới hạn số kết quả trả về cho autocomplete. */
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

function parseLimit(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), MAX_SEARCH_LIMIT);
}

/**
 * Địa danh hành chính 2 cấp (tỉnh/thành phố → phường/xã/đặc khu).
 *
 * Nguồn dữ liệu là danh mục dùng chung trong `packages/shared` nên FE và BE
 * luôn khớp nhau, không cần bảng DB riêng cho đơn vị hành chính.
 * Khớp `docs/11-api-contract.md` – nhóm "Admin catalogs" / "Địa danh".
 */
@ApiTags("Locations")
@Controller()
export class LocationsController {
  @Get("provinces")
  @ApiOperation({ summary: "Danh mục tỉnh/thành phố (public)" })
  listProvinces(): Province[] {
    return PROVINCES;
  }

  /**
   * `GET /provinces/:codeOrId/wards` — nhận cả `code` (vd `79`) và `id` (uuid)
   * vì FE có hai nguồn dữ liệu khác nhau (select tỉnh và bộ lọc theo khu vực).
   */
  @Get("provinces/:codeOrId/wards")
  @ApiOperation({ summary: "Danh sách phường/xã theo tỉnh (public)" })
  listWardsByProvince(
    @Param("codeOrId") codeOrId: string,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
  ): Ward[] {
    const province = PROVINCES.find((item) => item.code === codeOrId || item.id === codeOrId);
    if (!province) return [];

    const wards = loadWards().filter((ward) => ward.provinceCode === province.code);
    const keyword = q?.trim();
    const filtered = keyword ? wards.filter((ward) => matchUnaccent(keyword, ward.name)) : wards;
    return limit ? filtered.slice(0, parseLimit(limit, DEFAULT_SEARCH_LIMIT)) : filtered;
  }

  @Get("provinces/:provinceId/districts")
  @ApiOperation({
    summary: "Cấp huyện đã bỏ từ 01/07/2025 – luôn trả mảng rỗng",
    description:
      "Giữ route để FE cũ không lỗi 404; mô hình hiện tại chỉ còn 2 cấp nên dùng `/provinces/:code/wards`.",
  })
  listDistricts(): District[] {
    return [];
  }

  @Get("wards/search")
  @ApiOperation({ summary: "Autocomplete phường/xã theo từ khoá không dấu (public)" })
  searchWards(
    @Query("q") q = "",
    @Query("provinceCode") provinceCode?: string,
    @Query("limit") limit?: string,
  ): Ward[] {
    const keyword = q.trim();
    const pool = provinceCode
      ? loadWards().filter((ward) => ward.provinceCode === provinceCode)
      : loadWards();
    const matched = keyword ? pool.filter((ward) => matchUnaccent(keyword, ward.name)) : pool;
    return matched.slice(0, parseLimit(limit, DEFAULT_SEARCH_LIMIT));
  }
}