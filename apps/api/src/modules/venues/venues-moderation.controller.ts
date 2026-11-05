import { Body, Controller, Param, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiParam,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { uuidSchema } from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import {
  venueStatusOpenApi,
  privateVenueResponseOpenApi,
} from "./dto/venue.swagger.js";
import { VenuesService } from "./venues.service.js";

@ApiTags("Venues")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("venues")
export class VenuesModerationController {
  constructor(private readonly service: VenuesService) {}
  @Patch(":id/status")
  @ApiOperation({ summary: "Admin venue moderation" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: venueStatusOpenApi })
  @ApiResponse({ status: 200, schema: privateVenueResponseOpenApi })
  @ApiResponse({
    status: 400,
    description: "VALIDATION_ERROR / INVALID_STATUS_TRANSITION",
  })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
  @ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body() body: unknown,
  ) {
    return this.service.moderate(user.id, id, body);
  }
}
