import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { FavoritesService } from "./favorites.service.js";

@ApiTags("Favorites")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard)
@Controller("favorites")
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách cơ sở yêu thích của khách hàng" })
  @ApiResponse({ status: 200, description: "Danh sách VenueListItem" })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED" })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.list(user.id);
    return { data };
  }

  @Put(":venueId")
  @HttpCode(200)
  @ApiOperation({ summary: "Thêm cơ sở vào yêu thích (idempotent)" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Đã thêm yêu thích" })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED" })
  @ApiResponse({ status: 404, description: "VENUE_NOT_FOUND" })
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Param("venueId") venueId: string,
  ) {
    const result = await this.service.add(user.id, venueId);
    return { data: result };
  }

  @Delete(":venueId")
  @HttpCode(200)
  @ApiOperation({ summary: "Bỏ cơ sở khỏi yêu thích (idempotent)" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Đã xóa yêu thích" })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED" })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("venueId") venueId: string,
  ) {
    const result = await this.service.remove(user.id, venueId);
    return { data: result };
  }
}
