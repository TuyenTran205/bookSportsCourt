import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  customType,
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';
import type { BankAccountInfo } from '../../../../../packages/shared/src/types.js';

const tstzrange = customType<{ data: string; driverData: string }>({
  dataType: () => 'tstzrange',
});

const id = () => uuid().primaryKey().$defaultFn(() => v7());
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
const deletedAt = () => timestamp('deleted_at', { withTimezone: true });

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text().notNull(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    phone: text(),
    avatarUrl: text('avatar_url'),
    role: text().notNull().default('customer'),
    status: text().notNull().default('active'),
    sessionVersion: integer('session_version').notNull().default(0),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    uniqueIndex('idx_users_email_active')
      .on(table.email)
      .where(isNull(table.deletedAt)),
    index('idx_users_role').on(table.role).where(isNull(table.deletedAt)),
  ],
);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    providerId: text('provider_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_oauth_provider_id').on(table.provider, table.providerId),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revoked: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_refresh_tokens_hash').on(table.tokenHash),
    index('idx_rt_user').on(table.userId).where(eq(table.revoked, false)),
  ],
);

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_auth_tokens_hash').on(table.tokenHash),
    index('idx_auth_tokens_user')
      .on(table.userId, table.type)
      .where(isNull(table.usedAt)),
  ],
);

export const ownerApplications = pgTable(
  'owner_applications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    businessName: text('business_name').notNull(),
    taxCode: text('tax_code'),
    phone: text().notNull(),
    address: text().notNull(),
    lat: numeric({ precision: 10, scale: 7 }),
    lng: numeric({ precision: 10, scale: 7 }),
    note: text(),
    bankBin: text('bank_bin'),
    bankName: text('bank_name'),
    accountNo: text('account_no'),
    accountName: text('account_name'),
    status: text().notNull().default('pending'),
    reviewNote: text('review_note'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_owner_app_pending')
      .on(table.userId)
      .where(eq(table.status, 'pending')),
    index('idx_owner_app_status').on(table.status),
  ],
);

export const areas = pgTable(
  'areas',
  {
    id: id(),
    code: varchar({ length: 10 }),
    type: text().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    unaccentName: text('unaccent_name'),
    parentId: uuid('parent_id').references((): AnyPgColumn => areas.id, {
      onDelete: 'restrict',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_areas_parent').on(table.parentId),
    index('idx_areas_code').on(table.code),
    index('idx_areas_type_parent').on(table.type, table.parentId),
    uniqueIndex('uq_areas_parent_slug').on(table.parentId, table.slug),
  ],
);

export const sports = pgTable('sports', {
  id: id(),
  name: text().notNull(),
  slug: text().notNull(),
  icon: text(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const amenities = pgTable('amenities', {
  id: id(),
  name: text().notNull(),
  slug: text().notNull(),
  icon: text(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const venues = pgTable(
  'venues',
  {
    id: id(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    address: text().notNull(),
    provinceId: uuid('province_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'restrict' }),
    wardId: uuid('ward_id').references((): AnyPgColumn => areas.id, {
      onDelete: 'restrict',
    }),
    districtId: uuid('district_id').references((): AnyPgColumn => areas.id, {
      onDelete: 'restrict',
    }),
    lat: numeric({ precision: 10, scale: 7 }),
    lng: numeric({ precision: 10, scale: 7 }),
    status: text().notNull().default('pending'),
    coverUrl: text('cover_url'),
    rejectionReason: text('rejection_reason'),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 })
      .notNull()
      .default('0'),
    reviewCount: integer('review_count').notNull().default(0),
    fromPrice: integer('from_price'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    uniqueIndex('uq_venues_slug').on(table.slug),
    index('idx_venues_owner').on(table.ownerId).where(isNull(table.deletedAt)),
    index('idx_venues_status').on(table.status).where(isNull(table.deletedAt)),
    index('idx_venues_area')
      .on(table.provinceId, table.districtId)
      .where(isNull(table.deletedAt)),
    index('idx_venues_province_ward')
      .on(table.provinceId, table.wardId)
      .where(isNull(table.deletedAt)),
    index('idx_venues_rating')
      .on(table.ratingAvg)
      .where(and(eq(table.status, 'approved'), isNull(table.deletedAt))!),
    index('idx_venues_price')
      .on(table.fromPrice)
      .where(and(eq(table.status, 'approved'), isNull(table.deletedAt))!),
  ],
);

export const venueImages = pgTable('venue_images', {
  id: id(),
  venueId: uuid('venue_id')
    .notNull()
    .references(() => venues.id, { onDelete: 'cascade' }),
  url: text().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const venueSports = pgTable(
  'venue_sports',
  {
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    sportId: uuid('sport_id')
      .notNull()
      .references(() => sports.id, { onDelete: 'restrict' }),
  },
  (table) => [primaryKey({ columns: [table.venueId, table.sportId] })],
);

export const venueAmenities = pgTable(
  'venue_amenities',
  {
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    amenityId: uuid('amenity_id')
      .notNull()
      .references(() => amenities.id, { onDelete: 'restrict' }),
  },
  (table) => [primaryKey({ columns: [table.venueId, table.amenityId] })],
);

export const venuePaymentAccounts = pgTable('venue_payment_accounts', {
  venueId: uuid('venue_id')
    .primaryKey()
    .references(() => venues.id, { onDelete: 'cascade' }),
  bankBin: text('bank_bin').notNull(),
  accountNo: text('account_no').notNull(),
  accountName: text('account_name').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cancellationPolicies = pgTable('cancellation_policies', {
  venueId: uuid('venue_id')
    .primaryKey()
    .references(() => venues.id, { onDelete: 'cascade' }),
  cancelBeforeHours: integer('cancel_before_hours').notNull().default(24),
  refundPercent: integer('refund_percent').notNull().default(100),
  depositPercent: integer('deposit_percent').notNull().default(100),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const courts = pgTable(
  'courts',
  {
    id: id(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    sportId: uuid('sport_id').references(() => sports.id, {
      onDelete: 'restrict',
    }),
    status: text().notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    index('idx_courts_venue').on(table.venueId).where(isNull(table.deletedAt)),
  ],
);

export const openingHours = pgTable(
  'opening_hours',
  {
    id: id(),
    courtId: uuid('court_id')
      .notNull()
      .references(() => courts.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    openTime: time('open_time').notNull(),
    closeTime: time('close_time').notNull(),
  },
  (table) => [
    uniqueIndex('uq_opening_hours_court_day').on(
      table.courtId,
      table.dayOfWeek,
    ),
  ],
);

export const pricingRules = pgTable(
  'pricing_rules',
  {
    id: id(),
    courtId: uuid('court_id')
      .notNull()
      .references(() => courts.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    pricePerSlot: integer('price_per_slot').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    dayOfWeek: smallint('day_of_week').array(),
    dateOverride: date('date_override'),
    priority: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('idx_pricing_court').on(table.courtId)],
);

export const blackoutPeriods = pgTable(
  'blackout_periods',
  {
    id: id(),
    courtId: uuid('court_id')
      .notNull()
      .references(() => courts.id, { onDelete: 'cascade' }),
    reason: text(),
    during: tstzrange('during').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('idx_blackout_court').on(table.courtId)],
);

export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    courtId: uuid('court_id')
      .notNull()
      .references(() => courts.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    source: text().notNull().default('online'),
    guestName: text('guest_name'),
    guestPhone: text('guest_phone'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    during: tstzrange('during').notNull(),
    status: text().notNull().default('held'),
    totalPrice: integer('total_price').notNull(),
    depositAmount: integer('deposit_amount').notNull(),
    note: text(),
    cancelledBy: uuid('cancelled_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancelReason: text('cancel_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    remindersSentAt: timestamp('reminders_sent_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_bookings_court_during').on(table.courtId, table.during),
    index('idx_bookings_customer').on(table.customerId),
    index('idx_bookings_start').on(sql`lower(${table.during})`),
    index('idx_bookings_status').on(table.status),
    index('idx_bookings_expires')
      .on(table.expiresAt)
      .where(eq(table.status, 'held')),
    index('idx_bookings_pending')
      .on(table.courtId)
      .where(eq(table.status, 'pending_payment')),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    amount: integer().notNull(),
    provider: text().notNull().default('bank_transfer'),
    transferCode: text('transfer_code'),
    proofUrl: text('proof_url'),
    bankAccountSnapshot: jsonb('bank_account_snapshot').$type<BankAccountInfo>(),
    proofObjectKey: text('proof_object_key'),
    proofUpdatedAt: timestamp('proof_updated_at', { withTimezone: true }),
    refundNote: text('refund_note'),
    proofUploadedAt: timestamp('proof_uploaded_at', { withTimezone: true }),
    status: text().notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectReason: text('reject_reason'),
    refundAmount: integer('refund_amount'),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    idempotencyKey: text('idempotency_key'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_payments_idempotency_key').on(table.idempotencyKey),
    uniqueIndex('idx_payments_transfer_code')
      .on(table.transferCode)
      .where(isNotNull(table.transferCode)),
    index('idx_payments_booking').on(table.bookingId),
    index('idx_payments_collected_at').on(table.paidAt)
      .where(sql`${table.status} in ('completed','refunded') and ${table.paidAt} is not null`),
    index('idx_payments_refunded_at').on(table.refundedAt)
      .where(sql`${table.status} = 'refunded' and ${table.refundAmount} is not null and ${table.refundedAt} is not null`),
    index('idx_payments_pending_proof')
      .on(table.proofUploadedAt)
      .where(eq(table.status, 'submitted')),
    uniqueIndex('uq_payments_active')
      .on(table.bookingId)
      .where(
        or(
          eq(table.status, 'pending'),
          eq(table.status, 'submitted'),
          eq(table.status, 'completed'),
        )!,
      ),
  ],
);

export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    rating: smallint().notNull(),
    content: text(),
    isVisible: boolean('is_visible').notNull().default(true),
    ownerReply: text('owner_reply'),
    ownerRepliedAt: timestamp('owner_replied_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_reviews_booking').on(table.bookingId),
    index('idx_reviews_venue').on(table.venueId),
  ],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.venueId] })],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    eventKey: text('event_key'),
    title: text().notNull(),
    body: text().notNull(),
    data: jsonb(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_notif_user_unread')
      .on(table.userId)
      .where(isNull(table.readAt)),
    uniqueIndex('uq_notifications_event_user').on(table.eventKey, table.userId).where(isNotNull(table.eventKey)),
  ],
);

// CHECK constraints and triggers are versioned in 0008_phase4-foundation.sql.
export const oauthStates = pgTable('oauth_states', {
  id: id(),
  stateHash: text('state_hash').notNull(),
  bindingHash: text('binding_hash').notNull(),
  nonceHash: text('nonce_hash').notNull(),
  pkceVerifierCiphertext: text('pkce_verifier_ciphertext').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('oauth_states_state_hash_key').on(table.stateHash), index('idx_oauth_states_expiry').on(table.expiresAt)]);

export const outboxDeliveries = pgTable('outbox_deliveries', {
  id: id(),
  eventKey: text('event_key').notNull(),
  eventType: text('event_type').notNull(),
  channel: text().notNull(),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  payload: jsonb().$type<Record<string, unknown>>().notNull(),
  status: text().notNull().default('pending'),
  attempts: integer().notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  leaseToken: uuid('lease_token'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  emailRequest: jsonb('email_request').$type<import('../../modules/mail/mail.transport.js').MailRequest>(),
  firstAttemptAt: timestamp('first_attempt_at', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex('uq_outbox_delivery').on(table.eventKey, table.channel, table.recipientId), index('idx_outbox_due').on(table.status, table.nextAttemptAt)]);

export const storageCleanupJobs = pgTable('storage_cleanup_jobs', {
  id: id(),
  objectKey: text('object_key').notNull(),
  notBefore: timestamp('not_before', { withTimezone: true }).notNull(),
  status: text().notNull().default('pending'),
  attempts: integer().notNull().default(0),
  leaseToken: uuid('lease_token'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex('storage_cleanup_jobs_object_key_key').on(table.objectKey), index('idx_storage_cleanup_due').on(table.status, table.notBefore)]);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    ipAddress: inet('ip_address'),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_audit_entity').on(table.entityType, table.entityId),
    index('idx_audit_actor').on(table.actorId),
    index('idx_audit_created').on(table.createdAt),
  ],
);
