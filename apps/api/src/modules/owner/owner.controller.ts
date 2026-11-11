import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ownerTimelineQuerySchema } from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { parseBody } from "../../common/utils/parse-body.js";
import { OwnerService } from "./owner.service.js";

@ApiTags("Owner")
@ApiCookieAuth("access_token")
@Controller("owner")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
export class OwnerController {
  constructor(private readonly service: OwnerService) {}

  @Get("timeline")
  @ApiOperation({ summary: "Lịch vận hành một ngày của cơ sở" })
  getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.service.getTimeline(
      user.id,
      parseBody(ownerTimelineQuerySchema, query),
    );
  }

}