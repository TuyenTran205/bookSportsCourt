import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditRepository } from './audit.repository.js';
@Module({ imports: [AuthModule], controllers: [AuditController], providers: [AuditRepository, AuditService] })
export class AuditModule {}
