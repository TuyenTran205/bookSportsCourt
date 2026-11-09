import { z } from 'zod';
import { AUDIT_ACTION_ENTITIES, type AuditAction } from '../../../../../packages/shared/src/constants.js';
import { auditDataSchema } from '../../../../../packages/shared/src/phase4-responses.js';
import { phase4IdSchema } from '../../../../../packages/shared/src/phase4-schemas.js';
import { auditLogs } from '../../database/schema/index.js';
import type { AuthTransaction } from '../auth/auth.repository.js';

type AuditData = z.infer<typeof auditDataSchema>;

/** Never owns a connection/transaction: failure must roll back the caller's mutation. */
export async function writeAudit(tx: AuthTransaction, input: {
  actorId: string | null; action: AuditAction; entityId: string;
  before: unknown; after: unknown;
}): Promise<void> {
  const entityType = Object.hasOwn(AUDIT_ACTION_ENTITIES, input.action) ? AUDIT_ACTION_ENTITIES[input.action] : undefined;
  if (!entityType) throw new Error('Unsupported audit action');
  const actorId = input.actorId === null ? null : phase4IdSchema.parse(input.actorId);
  if (actorId === null && input.action !== 'payment.review_expired') throw new Error('Audit actor required');
  const entityId = phase4IdSchema.parse(input.entityId);
  const before = input.before === null ? null : auditDataSchema.parse(input.before);
  const after = input.after === null ? null : auditDataSchema.parse(input.after);
  const canonical = (data: AuditData) => JSON.stringify(Object.entries(data).filter(([,value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)));
  if (before !== null && after !== null && canonical(before) === canonical(after)) return;
  await tx.insert(auditLogs).values({ actorId, entityId, entityType, action: input.action, oldData: before, newData: after });
}

/** Legacy JSON is untrusted; drop unknown or malformed fields without exposing PII. */
export function projectAuditData(data: unknown): AuditData | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const result: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(auditDataSchema.shape)) {
    const value = (data as Record<string, unknown>)[key];
    if (value !== undefined && schema.safeParse(value).success) result[key] = value;
  }
  return auditDataSchema.parse(result);
}
