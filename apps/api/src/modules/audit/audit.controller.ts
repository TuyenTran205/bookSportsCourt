import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { adminAuditQuerySchema, type AdminAuditQueryInput } from '../../../../../packages/shared/src/phase4-schemas.js';
import type { AuthenticatedUser } from '../../../../../packages/shared/src/types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuditService } from './audit.service.js';
import { auditListOpenApi } from './audit.swagger.js';

@ApiTags('Audit')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
@ApiResponse({ status: 401, description: 'UNAUTHORIZED / TOKEN_EXPIRED' })
@ApiResponse({ status: 403, description: 'FORBIDDEN / ACCOUNT_SUSPENDED' })
@ApiResponse({ status: 500, description: 'INTERNAL_ERROR' })
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get()
  @ApiOperation({ summary: 'Admin đọc nhật ký; mặc định 30 ngày, from inclusive/to exclusive, tối đa 366 ngày' })
  @ApiQuery({ name: 'actorId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'action', required: false, schema: { type: 'string', minLength: 1, maxLength: 100 } })
  @ApiQuery({ name: 'entityType', required: false, schema: { type: 'string', minLength: 1, maxLength: 100 } })
  @ApiQuery({ name: 'from', required: false, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'to', required: false, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiResponse({ status: 200, schema: auditListOpenApi })
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(adminAuditQuerySchema)) query: AdminAuditQueryInput) {
    return this.service.list(user.id, query);
  }
}
