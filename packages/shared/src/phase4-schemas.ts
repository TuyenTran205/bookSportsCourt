import { z } from 'zod';
import {
  BOOKING_STATUSES,
  OWNER_APPLICATION_STATUSES,
  PAYMENT_STATUSES,
  REVIEW_REPORT_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} from './constants.js';
import { uuidSchema, venuePageFields, updateOwnerApplicationStatusSchema, updateUserStatusSchema, reportReviewSchema } from './schemas.js';

export const phase4IdSchema = uuidSchema.transform((value) => value.toLowerCase());
export const vndSchema = z.number().int().nonnegative().safe();
const reason = z.string().trim().min(1).max(500);
export const paymentApproveSchema = z.object({}).strict();
export const noQuerySchema = z.object({}).strict();
export const paymentRejectSchema = z.object({ reason }).strict();
export const paymentRefundSchema = z.object({ note: z.string().trim().min(1).max(1000).optional() }).strict();
export const paymentAccountInputSchema = z.object({
  bankBin: z.string().trim().regex(/^[0-9]{6}$/),
  accountNo: z.string().trim().regex(/^[0-9]{6,30}$/),
  accountName: z.string().trim().min(2).max(200),
}).strict();
export const ownerPaymentQuerySchema = z.object({
  ...venuePageFields, status: z.union([z.enum(PAYMENT_STATUSES), z.literal('all')]).default('submitted'), venueId: phase4IdSchema.optional(),
}).strict();
export const adminOwnerApplicationQuerySchema = z.object({ ...venuePageFields, status: z.union([z.enum(OWNER_APPLICATION_STATUSES), z.literal('all')]).default('pending') }).strict();
export const ownerApplicationDecisionSchema = updateOwnerApplicationStatusSchema;
export const userStatusUpdateSchema = updateUserStatusSchema;
export const adminUserQuerySchema = z.object({
  ...venuePageFields, role: z.enum(USER_ROLES).optional(), status: z.enum(USER_STATUSES).optional(), q: z.string().trim().max(200).optional(),
}).strict();

export const phase4DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + 'T00:00:00Z');
  return Number(value.slice(0,4)) >= 1 && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const dateFields = { from: phase4DateSchema.optional(), to: phase4DateSchema.optional() };
function validRange(value: { from?: string; to?: string }, inclusive: boolean): boolean {
  if (value.from === undefined || value.to === undefined) return value.from === value.to;
  const elapsed = Date.parse(value.to) - Date.parse(value.from);
  return elapsed >= (inclusive ? 0 : 1) && elapsed <= (inclusive ? 365 : 366) * 86400000;
}
export const adminBookingQuerySchema = z.object({
  ...venuePageFields,
  ...dateFields,
  status: z.enum(BOOKING_STATUSES).optional(),
  venueId: phase4IdSchema.optional(),
  customerId: phase4IdSchema.optional(),
  q: z.string().trim().max(200).optional(),
}).strict().refine((value) => validRange(value, true), 'Both dates required, ordered, at most 366 inclusive days');
export const adminStatsQuerySchema = z.object({ ...dateFields, groupBy: z.enum(['day', 'week', 'month']).default('day') }).strict()
  .refine((value) => validRange(value, true), 'Both dates required, ordered, at most 366 inclusive days');
export const adminAuditQuerySchema = z.object({
  ...venuePageFields, actorId: phase4IdSchema.optional(), action: z.string().trim().min(1).max(100).optional(), entityType: z.string().trim().min(1).max(100).optional(),
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(),
}).strict().refine((value) => validRange(value, false), 'Both timestamps required, increasing, at most 366 days');
export const publicReviewQuerySchema = z.object(venuePageFields).strict();
export const adminReviewQuerySchema = z.object({
  ...venuePageFields,
  venueId: phase4IdSchema.optional(),
  isVisible: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  reportStatus: z.enum(REVIEW_REPORT_STATUSES).optional(),
  rating: z
    .union([
      z.number().int().min(1).max(5),
      z.enum(['1', '2', '3', '4', '5']).transform((value) => Number(value)),
    ])
    .optional(),
  q: z.string().trim().max(200).optional(),
}).strict();
export const reviewVisibilitySchema = z.object({ isVisible: z.boolean() }).strict();
export { reportReviewSchema };
export const moderateReviewReportSchema = z.object({
  action: z.enum(['approve', 'reject']),
}).strict();
export const googleCallbackQuerySchema = z.object({
  code: z.string().min(1).max(4096).optional(), state: z.string().min(1).max(512),
  error: z.string().min(1).max(200).optional(), error_description: z.string().max(1000).optional(),
  scope: z.string().max(2048).optional(), authuser: z.string().max(100).optional(),
  prompt: z.string().max(100).optional(), hd: z.string().max(255).optional(),
  iss: z.string().max(255).optional(),
}).strict().refine((value) => (value.code !== undefined) !== (value.error !== undefined), 'Exactly one code or error required');

// DTO aliases derive from the shared validation source; no controller-specific enums.
export type PaymentApproveInput = z.infer<typeof paymentApproveSchema>;
export type PaymentRejectInput = z.infer<typeof paymentRejectSchema>;
export type PaymentRefundInput = z.infer<typeof paymentRefundSchema>;
export type PaymentAccountInput = z.infer<typeof paymentAccountInputSchema>;
export type OwnerPaymentQueryInput = z.infer<typeof ownerPaymentQuerySchema>;
export type AdminOwnerApplicationQueryInput = z.infer<typeof adminOwnerApplicationQuerySchema>;
export type OwnerApplicationDecisionInput = z.infer<typeof ownerApplicationDecisionSchema>;
export type UserStatusUpdateInput = z.infer<typeof userStatusUpdateSchema>;
export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;
export type AdminBookingQueryInput = z.infer<typeof adminBookingQuerySchema>;
export type AdminStatsQueryInput = z.infer<typeof adminStatsQuerySchema>;
export type AdminAuditQueryInput = z.infer<typeof adminAuditQuerySchema>;
export type PublicReviewQueryInput = z.infer<typeof publicReviewQuerySchema>;
export type AdminReviewQueryInput = z.infer<typeof adminReviewQuerySchema>;
export type ReviewVisibilityInput = z.infer<typeof reviewVisibilitySchema>;
export type ReportReviewInput = z.infer<typeof reportReviewSchema>;
export type ModerateReviewReportInput = z.infer<typeof moderateReviewReportSchema>;
export type GoogleCallbackQueryInput = z.infer<typeof googleCallbackQuerySchema>;
