import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  ownerVenueQuerySchema,
  adminVenueQuerySchema,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type {
  OwnerVenueQueryDto,
  AdminVenueQueryDto,
} from "./dto/venue.dto.js";
import {
  ApiVenueQuery,
  privateVenueListResponseOpenApi,
  publicVenueResponseOpenApi,
} from "./dto/venue.swagger.js";
import { VenuesService } from "./venues.service.js";

@ApiTags("Venues")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
@ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@Controller("owner/venues")
export class OwnerVenuesController {
  constructor(private readonly service: VenuesService) {}
  @Get()
  @ApiOperation({ summary: "Owner venue list" })
  @ApiVenueQuery("owner")
  @ApiResponse({ status: 200, schema: privateVenueListResponseOpenApi })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ownerVenueQuerySchema))
    query: OwnerVenueQueryDto,
  ) {
    return this.service.list(query, user.id);
  }
}

@ApiTags("Venues")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@Controller("admin/venues")
export class AdminVenuesController {
  constructor(private readonly service: VenuesService) {}
  @Get()
  @ApiOperation({ summary: "Admin moderation queue" })
  @ApiVenueQuery("admin")
  @ApiResponse({ status: 200, schema: privateVenueListResponseOpenApi })
  list(
    @Query(new ZodValidationPipe(adminVenueQuerySchema))
    query: AdminVenueQueryDto,
  ) {
    return this.service.list(query);
  }
}

@ApiTags("Venues")
@Controller("venues")
export class PublicVenuesController {
  constructor(private readonly service: VenuesService) {}
  // VenueExtensionsController (including static /map) is registered before this controller.
  @Get(":slug")
  @ApiOperation({ summary: "Public approved venue detail by slug or UUID" })
  @ApiParam({
    name: "slug",
    description: "Exact slug or UUID (UUID takes precedence)",
  })
  @ApiResponse({ status: 200, schema: publicVenueResponseOpenApi })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  detail(@Param("slug") slug: string) {
    return this.service.publicDetail(slug);
  }
}
