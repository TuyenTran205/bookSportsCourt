import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lt } from 'drizzle-orm';
import { InjectDrizzle, type DrizzleDb } from '../../database/database.module.js';
import { auditLogs } from '../../database/schema/index.js';
import type { AdminAuditQueryInput } from '../../../../../packages/shared/src/phase4-schemas.js';

@Injectable()
export class AuditRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  list(query: AdminAuditQueryInput, from: Date, to: Date) {
    const where = and(
      query.actorId ? eq(auditLogs.actorId, query.actorId) : undefined,
      query.action ? eq(auditLogs.action, query.action) : undefined,
      query.entityType ? eq(auditLogs.entityType, query.entityType) : undefined,
      gte(auditLogs.createdAt, from), lt(auditLogs.createdAt, to),
    );
    return this.db.transaction(async (tx) => {
      const [result] = await tx.select({ total: count() }).from(auditLogs).where(where);
      const total = Number(result?.total ?? 0);
      const totalPages = Math.ceil(total / query.limit);
      if (query.page > totalPages) return { rows: [], meta: { page: query.page, limit: query.limit, total, totalPages } };
      const rows = await tx.select({
        id: auditLogs.id, actorId: auditLogs.actorId, action: auditLogs.action,
        entityType: auditLogs.entityType, entityId: auditLogs.entityId,
        oldData: auditLogs.oldData, newData: auditLogs.newData, createdAt: auditLogs.createdAt,
      }).from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(query.limit).offset((query.page - 1) * query.limit);
      return { rows, meta: { page: query.page, limit: query.limit, total, totalPages } };
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }
}
