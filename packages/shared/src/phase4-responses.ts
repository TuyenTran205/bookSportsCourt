import { z } from 'zod';
import { BOOKING_SOURCES, BOOKING_STATUSES, OWNER_APPLICATION_STATUSES, PAYMENT_PROVIDERS, PAYMENT_STATUSES, USER_ROLES, USER_STATUSES, VENUE_STATUSES } from './constants.js';
import { phase4IdSchema as id, phase4DateSchema, paymentAccountInputSchema, vndSchema as money } from './phase4-schemas.js';

const timestamp = z.string().datetime({ offset: true });
const nullableTimestamp = timestamp.nullable();
const timestamps = { createdAt: timestamp, updatedAt: timestamp };
const nullableText = z.string().nullable();
export const paymentViewSchema = z.object({
  id, bookingId: id, provider: z.enum(PAYMENT_PROVIDERS), amount: money, transferCode: nullableText,
  bankAccount: paymentAccountInputSchema.nullable(), status: z.enum(PAYMENT_STATUSES), bookingStatus: z.enum(BOOKING_STATUSES),
  proofUrl: z.string().url().nullable(), proofUrlExpiresAt: nullableTimestamp, proofUploadedAt: nullableTimestamp,
  proofUpdatedAt: nullableTimestamp, reviewDeadline: nullableTimestamp, reviewedBy: id.nullable(), reviewedAt: nullableTimestamp,
  rejectReason: nullableText, paidAt: nullableTimestamp, refundAmount: money.nullable(), refundedAt: nullableTimestamp, ...timestamps,
}).strict();
export const ownerPaymentItemSchema = paymentViewSchema.extend({ venueId: id, courtId: id, bookingStart: timestamp, bookingEnd: timestamp, customerId: id.nullable() });
export const ownerApplicationViewSchema = z.object({
  id, userId: id, businessName: z.string(), phone: z.string(), address: z.string(),
  lat: z.number().nullable().optional(), lng: z.number().nullable().optional(),
  note: nullableText, taxCode: nullableText,
  status: z.enum(OWNER_APPLICATION_STATUSES), reviewNote: nullableText, reviewedBy: id.nullable(), reviewedAt: nullableTimestamp, ...timestamps,
}).strict();
export const userListItemSchema = z.object({
  id, fullName: z.string(), email: z.string().email(), phoneMasked: nullableText, avatarUrl: nullableText,
  role: z.enum(USER_ROLES), status: z.enum(USER_STATUSES), ...timestamps,
}).strict();
export const userAdminDetailSchema = userListItemSchema.extend({ phone: nullableText, emailVerifiedAt: nullableTimestamp });
export const bookingAdminSchema = z.object({
  id, courtId: id, venueId: id, customerId: id.nullable(), source: z.enum(BOOKING_SOURCES), guestName: nullableText,
  guestPhoneMasked: nullableText, start: timestamp, end: timestamp, status: z.enum(BOOKING_STATUSES), totalPrice: money, depositAmount: money,
  expiresAt: nullableTimestamp, cancelReason: nullableText, cancelledAt: nullableTimestamp, ...timestamps,
  payment: paymentViewSchema.pick({ id: true, provider: true, amount: true, status: true, paidAt: true, refundAmount: true, refundedAt: true }).nullable(),
}).strict();
export const auditDataSchema = z.object({
  status: z.enum([...BOOKING_STATUSES, ...PAYMENT_STATUSES, ...VENUE_STATUSES, ...USER_STATUSES, ...OWNER_APPLICATION_STATUSES]).optional(), role: z.enum(USER_ROLES).optional(), isVisible: z.boolean().optional(),
  hasReason: z.boolean().optional(), hasRejectionReason: z.boolean().optional(), bookingStatus: z.enum(BOOKING_STATUSES).optional(), paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
}).strict();
export const auditViewSchema = z.object({ id, actorId: id.nullable(), action: z.string(), entityType: z.string(), entityId: id.nullable(), oldData: auditDataSchema.nullable(), newData: auditDataSchema.nullable(), createdAt: timestamp }).strict();
export const reviewPublicSchema = z.object({ id, venueId: id, rating: z.number().int().min(1).max(5), comment: nullableText, ownerReply: nullableText, ownerRepliedAt: nullableTimestamp, createdAt: timestamp }).strict();
export const reviewAdminSchema = reviewPublicSchema.extend({ bookingId: id, customerId: id, isVisible: z.boolean(), updatedAt: timestamp });

const counts = <T extends readonly [string, ...string[]]>(values: T) => z.object(Object.fromEntries(values.map((key) => [key, money])) as { [K in T[number]]: typeof money }).strict();
const revenue = { bookingCountsByStatus: counts(BOOKING_STATUSES), grossRevenue: money, refundedAmount: money, netRevenue: z.number().int().safe() };
export const adminStatsSchema = z.object({
  generatedAt: timestamp, from: phase4DateSchema, to: phase4DateSchema, groupBy: z.enum(['day', 'week', 'month']),
  summary: z.object({ ...revenue, userCountsByRole: counts(USER_ROLES), venueCountsByStatus: counts(VENUE_STATUSES) }).strict(),
  series: z.array(z.object({ date: phase4DateSchema, ...revenue }).strict()), dataQuality: z.object({ excludedPaymentCount: money }).strict(),
}).strict();
export const paginationMetaSchema = z.object({ page: z.number().int().positive().safe(), limit: z.number().int().min(1).max(100), total: money, totalPages: money }).strict();
export const phase4DataEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema }).strict();
export const phase4ListEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: z.array(schema), meta: paginationMetaSchema }).strict();
export const phase4ErrorEnvelopeSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), httpStatus: z.number().int(), details: z.record(z.array(z.string())).optional() }).strict() }).strict();

export type PaymentView = z.infer<typeof paymentViewSchema>;
export type OwnerPaymentItem = z.infer<typeof ownerPaymentItemSchema>;
export type OwnerApplicationView = z.infer<typeof ownerApplicationViewSchema>;
export type UserListItem = z.infer<typeof userListItemSchema>;
export type UserAdminDetail = z.infer<typeof userAdminDetailSchema>;
export type BookingAdmin = z.infer<typeof bookingAdminSchema>;
export type AuditView = z.infer<typeof auditViewSchema>;
export type ReviewPublic = z.infer<typeof reviewPublicSchema>;
export type ReviewAdmin = z.infer<typeof reviewAdminSchema>;
export type AdminStats = z.infer<typeof adminStatsSchema>;
