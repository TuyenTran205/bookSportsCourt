import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ownerApplicationSchema, createReviewSchema } from './schemas.js';
import * as input from './phase4-schemas.js';
import * as output from './phase4-responses.js';

const id = '019a0000-0004-7000-8000-000000000001';
describe('Phase 4 shared contract', () => {
  it('accepts exactly one Google callback code/error, bounded known metadata and no identity input', () => {
    expect(input.googleCallbackQuerySchema.safeParse({state:'state',code:'code',scope:'openid email',authuser:'0',prompt:'consent'}).success).toBe(true);
    expect(input.googleCallbackQuerySchema.safeParse({state:'state',error:'access_denied',error_description:'cancelled'}).success).toBe(true);
    for(const value of [{state:'state'},{state:'state',code:'code',error:'error'},{state:'state',code:['a','b']},
      {state:'state',code:'code',email:'injected@example.test'},{state:'state',code:'code',redirect:'https://evil.test'},
      {state:'state',code:'code',scope:'a'.repeat(2049)}]) expect(input.googleCallbackQuerySchema.safeParse(value).success).toBe(false);
  });
  it('strict mutation allowlists and trimmed reasons', () => {
    expect(input.paymentRejectSchema.parse({ reason: '  Invalid proof  ' })).toEqual({ reason: 'Invalid proof' });
    for (const reason of ['', '   ', 'a'.repeat(501)]) expect(input.paymentRejectSchema.safeParse({ reason }).success).toBe(false);
    expect(input.paymentApproveSchema.safeParse({ amount: 1 }).success).toBe(false);
    expect(input.paymentRefundSchema.safeParse({ refundAmount: 100 }).success).toBe(false);
    expect(input.userStatusUpdateSchema.safeParse({ status: 'pending' }).success).toBe(false);
    expect(input.reviewVisibilitySchema.safeParse({ isVisible: 'false' }).success).toBe(false);
    expect(input.ownerApplicationDecisionSchema.safeParse({ status: 'rejected' }).success).toBe(false);
    expect(input.ownerApplicationDecisionSchema.safeParse({ status: 'rejected', reviewNote: '   ' }).success).toBe(false);
    expect(input.ownerApplicationDecisionSchema.safeParse({ status: 'approved' }).success).toBe(true);
  });
  it('rejects coercion, unknown query fields, repeated values and unsafe pagination', () => {
    expect(input.ownerPaymentQuerySchema.parse({})).toEqual({ page: 1, limit: 20, status: 'submitted' });
    expect(input.adminOwnerApplicationQuerySchema.parse({}).status).toBe('pending');
    for (const page of ['', '1e2', '1.5', '0', ['1','2'], true, '9007199254740992']) expect(input.ownerPaymentQuerySchema.safeParse({ page }).success).toBe(false);
    expect(input.ownerPaymentQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(input.ownerPaymentQuerySchema.safeParse({ ownerId: id }).success).toBe(false);
    expect(input.adminReviewQuerySchema.parse({ isVisible: 'false' }).isVisible).toBe(false);
    expect(input.adminReviewQuerySchema.safeParse({ isVisible: ['true'] }).success).toBe(false);
    expect(input.phase4IdSchema.parse(id.toUpperCase())).toBe(id);
  });
  it('validates real calendar days, paired boundaries and inclusive 366-day maximum', () => {
    expect(input.phase4DateSchema.safeParse('0000-01-01').success).toBe(false);
    for (const value of [{ from: '2026-02-29', to: '2026-03-01' }, { from: '2026-01-01' }, { from: '2026-03-02', to: '2026-03-01' }, { from: '2024-01-01', to: '2025-01-01' }]) expect(input.adminBookingQuerySchema.safeParse(value).success).toBe(false);
    expect(input.adminBookingQuerySchema.safeParse({ from: '2024-01-01', to: '2024-12-31' }).success).toBe(true);
    expect(input.adminBookingQuerySchema.safeParse({ from: '2026-11-06', to: '2026-11-06' }).success).toBe(true);
    expect(input.adminAuditQuerySchema.safeParse({ from: '2026-11-06T00:00:00+07:00', to: '2026-11-06T01:00:00+07:00' }).success).toBe(true);
    expect(input.adminAuditQuerySchema.safeParse({ from: '2026-11-06', to: '2026-11-07' }).success).toBe(false);
  });
  it('validates Owner input/tax and numeric review rating before persistence', () => {
    const app = { businessName: ' Business ', phone: '0912 345 678', address: '123 Street', taxCode: '0123456789012' };
    expect(ownerApplicationSchema.parse(app).businessName).toBe('Business');
    expect(ownerApplicationSchema.parse(app).phone).toBe('0912345678');
    expect(ownerApplicationSchema.safeParse({ ...app, businessName: '  ' }).success).toBe(false);
    expect(ownerApplicationSchema.safeParse({ ...app, bankAccount: {} }).success).toBe(false);
    expect(createReviewSchema.safeParse({ bookingId: id, rating: '5' }).success).toBe(false);
    expect(createReviewSchema.safeParse({ bookingId: id, rating: 5, isVisible: true }).success).toBe(false);
    expect(input.paymentAccountInputSchema.safeParse({ bankBin: '970436', accountNo: '123456', accountName: '  ' }).success).toBe(false);
  });
  it('prevents private-field leakage and retains nullable/required response fields', () => {
    expect(output.auditDataSchema.safeParse({ bankAccount: {}, token: 'secret' }).success).toBe(false);
    expect(output.auditDataSchema.safeParse({ hasRejectionReason: true }).success).toBe(true);
    expect(output.paymentViewSchema.shape.bankAccount.safeParse(null).success).toBe(true);
    expect(output.paymentViewSchema.shape.bankAccount.safeParse(undefined).success).toBe(false);
    expect(output.adminStatsSchema.shape.summary.shape.netRevenue.safeParse(-1000).success).toBe(true);
    expect(input.vndSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });
  it('matches response field names, requiredness and nullability against OpenAPI', () => {
    const spec = JSON.parse(readFileSync(new URL('../../../docs/openapi/phase-04.openapi.json', import.meta.url), 'utf8'));
    const schemas: Record<string, z.AnyZodObject> = {
      PaymentView: output.paymentViewSchema, OwnerPaymentItem: output.ownerPaymentItemSchema, OwnerApplicationView: output.ownerApplicationViewSchema,
      UserListItem: output.userListItemSchema, UserAdminDetail: output.userAdminDetailSchema, BookingAdmin: output.bookingAdminSchema,
      AuditView: output.auditViewSchema, ReviewPublic: output.reviewPublicSchema, ReviewAdmin: output.reviewAdminSchema, AdminStats: output.adminStatsSchema,
    };
    for (const [name, schema] of Object.entries(schemas)) {
      const contract = spec.components.schemas[name];
      expect(Object.keys(schema.shape).sort(), name).toEqual(Object.keys(contract.properties).sort());
      for (const [key, field] of Object.entries(schema.shape) as Array<[string, z.ZodTypeAny]>) {
        const property = contract.properties[key];
        expect(field.isOptional(), name + '.' + key).toBe(!contract.required.includes(key));
        expect(field.isNullable(), name + '.' + key).toBe(Boolean(property.nullable || property.oneOf?.some((v: { nullable?: boolean }) => v.nullable)));
        if (field instanceof z.ZodEnum && property.enum) expect([...field.options].sort(), name + '.' + key).toEqual([...property.enum].sort());
      }
    }
    expect(input.adminUserQuerySchema.shape.status.unwrap().options).toEqual(spec.paths['/admin/users'].get.parameters.find((p: { name: string }) => p.name === 'status').schema.enum);
  });
});
