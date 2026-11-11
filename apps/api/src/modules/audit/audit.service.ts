import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AdminAuditQueryInput } from '../../../../../packages/shared/src/phase4-schemas.js';
import type { AuditView } from '../../../../../packages/shared/src/phase4-responses.js';
import { AuthService } from '../auth/auth.service.js';
import { AuditRepository } from './audit.repository.js';
import { projectAuditData } from './audit-writer.js';

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository, private readonly auth: AuthService) {}

  async list(userId: string, query: AdminAuditQueryInput) {
    const user = await this.auth.requireActiveUser(userId);
    if (user.role !== 'admin') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Chỉ Admin được xem nhật ký.' });
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86400000);
    const result = await this.repository.list(query, from, to);
    const data: AuditView[] = result.rows.map((row) => ({
      id: row.id, actorId: row.actorId, action: row.action, entityType: row.entityType, entityId: row.entityId,
      oldData: projectAuditData(row.oldData), newData: projectAuditData(row.newData), createdAt: row.createdAt.toISOString(),
    }));
    return { data, meta: result.meta };
  }
}
