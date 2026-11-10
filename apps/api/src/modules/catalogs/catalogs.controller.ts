import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  amenitySchema,
  areaSchema,
  sportSchema,
} from "../../../../../packages/shared/src/schemas.js";
import { parseBody } from "../../common/utils/parse-body.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CatalogsService } from "./catalogs.service.js";

@ApiTags("Catalogs")
@Controller()
export class CatalogsController {
  constructor(private readonly service: CatalogsService) {}

  // ===== Sports =====

  @Get("sports")
  @ApiOperation({ summary: "Danh sách môn thể thao (public)" })
  getSports() {
    return this.service.getSports();
  }

  @Post("sports")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Tạo môn thể thao" })
  createSport(@Body() body: unknown) {
    const input = parseBody(sportSchema, body);
    return this.service.createSport(input);
  }

  @Patch("sports/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Cập nhật môn thể thao" })
  updateSport(@Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(sportSchema.partial(), body);
    return this.service.updateSport(id, input);
  }

  @Delete("sports/:id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Xoá môn thể thao" })
  deleteSport(@Param("id") id: string) {
    return this.service.deleteSport(id);
  }

  // ===== Amenities =====

  @Get("amenities")
  @ApiOperation({ summary: "Danh sách tiện ích (public)" })
  getAmenities() {
    return this.service.getAmenities();
  }

  @Post("amenities")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Tạo tiện ích" })
  createAmenity(@Body() body: unknown) {
    const input = parseBody(amenitySchema, body);
    return this.service.createAmenity(input);
  }

  @Patch("amenities/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Cập nhật tiện ích" })
  updateAmenity(@Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(amenitySchema.partial(), body);
    return this.service.updateAmenity(id, input);
  }

  @Delete("amenities/:id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Xoá tiện ích" })
  deleteAmenity(@Param("id") id: string) {
    return this.service.deleteAmenity(id);
  }

  // ===== Areas =====

  @Get("areas")
  @ApiOperation({ summary: "Danh sách khu vực (tỉnh/quận) (public)" })
  getAreas(
    @Query("type") type?: string,
    @Query("parentId") parentId?: string,
  ) {
    return this.service.getAreas({
      type,
      parentId: parentId ? parentId : undefined,
    });
  }

  @Post("areas")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Tạo khu vực" })
  createArea(@Body() body: unknown) {
    const input = parseBody(areaSchema, body);
    return this.service.createArea(input);
  }

  @Patch("areas/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Cập nhật khu vực" })
  updateArea(@Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(areaSchema.innerType().partial(), body);
    return this.service.updateArea(id, input);
  }

  @Delete("areas/:id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Xoá khu vực" })
  deleteArea(@Param("id") id: string) {
    return this.service.deleteArea(id);
  }

  // ===== Đơn vị Hành chính 2 cấp (Provinces & Wards) =====

  @Get("provinces")
  @ApiOperation({
    summary: "Danh sách 34 Tỉnh / Thành phố trực thuộc TW (public)",
  })
  getProvinces() {
    return this.service.getProvinces();
  }

  @Get("provinces/:codeOrId/wards")
  @ApiOperation({ summary: "Danh sách Xã / Phường theo Tỉnh (public)" })
  getWardsByProvince(
    @Param("codeOrId") codeOrId: string,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.getWardsByProvince(codeOrId, {
      q,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("wards/search")
  @ApiOperation({ summary: "Tìm kiếm Autocomplete Xã / Phường (public)" })
  searchWards(
    @Query("q") q?: string,
    @Query("provinceCode") provinceCode?: string,
    @Query("limit") limit?: string,
  ) {
    if (!q || !q.trim()) {
      return [];
    }
    return this.service.searchWards({
      q,
      provinceCode,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("provinces/:id/districts")
  @ApiOperation({ summary: "Danh sách Quận / Huyện cũ (legacy support)" })
  getDistrictsByProvince(@Param("id") id: string) {
    return this.service.getDistrictsByProvince(id);
  }
}
