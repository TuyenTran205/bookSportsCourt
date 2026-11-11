import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  blackoutListQuerySchema,
  blackoutSchema,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { parseBody } from "../../common/utils/parse-body.js";
import { OwnerService } from "./owner.service.js";

@ApiTags("Courts")
@Controller("courts/:courtId/blackouts")
export class BlackoutsController {
  constructor(private readonly service: OwnerService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách lịch khoá sân trong khoảng ngày" })
  list(
    @Param("courtId") courtId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.service.listBlackouts(
      courtId,
      parseBody(blackoutListQuerySchema, query),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Khoá một khoảng thời gian của sân" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courtId") courtId: string,
    @Body() body: unknown,
  ) {
    return this.service.createBlackout(
      user.id,
      courtId,
      parseBody(blackoutSchema, body),
    );
  }

  @Delete(":blackoutId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Bỏ lịch khoá sân" })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courtId") courtId: string,
    @Param("blackoutId") blackoutId: string,
  ) {
    return this.service.deleteBlackout(user.id, courtId, blackoutId);
  }
}