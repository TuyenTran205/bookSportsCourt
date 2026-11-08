import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface.js';
const nullableId: SchemaObject = { type: 'string', format: 'uuid', nullable: true };
const stateData: SchemaObject = {
  type: 'object', nullable: true, additionalProperties: false, required: [],
  properties: Object.fromEntries(['status', 'role', 'isVisible', 'hasReason', 'hasRejectionReason', 'bookingStatus', 'paymentStatus'].map((key) => [key, { type: ['isVisible','hasReason','hasRejectionReason'].includes(key) ? 'boolean' : 'string' }])),
};
export const auditViewOpenApi: SchemaObject = {
  type: 'object', additionalProperties: false,
  required: ['id','actorId','action','entityType','entityId','oldData','newData','createdAt'],
  properties: { id: { type: 'string', format: 'uuid' }, actorId: nullableId, action: { type: 'string' }, entityType: { type: 'string' }, entityId: nullableId, oldData: stateData, newData: stateData, createdAt: { type: 'string', format: 'date-time' } },
};
export const auditListOpenApi: SchemaObject = {
  type: 'object', additionalProperties: false, required: ['data','meta'],
  properties: {
    data: { type: 'array', items: auditViewOpenApi },
    meta: { type: 'object', additionalProperties: false, required: ['page','limit','total','totalPages'], properties: {
      page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 }, total: { type: 'integer', minimum: 0 }, totalPages: { type: 'integer', minimum: 0 },
    } },
  },
};
