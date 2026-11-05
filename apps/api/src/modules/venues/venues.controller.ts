import {
  Body,
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  HttpCode,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
} from "@nestjs/swagger";
import {
  createVenueSchema,
  updateVenueSchema,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { CreateVenueDto, UpdateVenueDto } from "./dto/venue.dto.js";
import { OwnershipGuard } from "../../common/guards/ownership.guard.js";
import { CheckOwnership } from "../../common/decorators/check-ownership.decorator.js";
import {
  createVenueOpenApi,
  privateVenueResponseOpenApi,
  updateVenueOpenApi,
} from "./dto/venue.swagger.js";
import { VenuesService } from "./venues.service.js";

@ApiTags("Venues")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
@Controller("venues")
export class VenuesController {
  constructor(private readonly service: VenuesService) {}

  @Patch(":id")
  @ApiOperation({ summary: "Owner updates own venue" })
  @UseGuards(OwnershipGuard)
  @CheckOwnership("venue")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: updateVenueOpenApi })
  @ApiResponse({ status: 200, schema: privateVenueResponseOpenApi })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
  @ApiResponse({
    status: 403,
    description: "FORBIDDEN / NOT_VENUE_OWNER / ACCOUNT_SUSPENDED",
  })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "ALREADY_EXISTS" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateVenueSchema)) body: UpdateVenueDto,
  ) {
    return this.service.update(user.id, id, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Owner soft-deletes own venue" })
  @HttpCode(204)
  @UseGuards(OwnershipGuard)
  @CheckOwnership("venue")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 204, description: "Deleted; no body" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
  @ApiResponse({
    status: 403,
    description: "FORBIDDEN / NOT_VENUE_OWNER / ACCOUNT_SUSPENDED",
  })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "RESOURCE_IN_USE" })
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.remove(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: "Owner tạo địa điểm chờ duyệt" })
  @ApiBody({ schema: createVenueOpenApi })
  @ApiResponse({ status: 201, schema: privateVenueResponseOpenApi })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
  @ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
  @ApiResponse({ status: 409, description: "ALREADY_EXISTS" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createVenueSchema)) body: CreateVenueDto,
  ) {
    return this.service.create(user.id, body);
  }
}
