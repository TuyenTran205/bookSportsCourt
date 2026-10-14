/**
 * Hằng số & enum dùng chung toàn hệ thống.
 *
 * Nguồn: docs/04-database-schema.md (ràng buộc CHECK) và docs/11-api-contract.md.
 * Mọi enum ở đây phải khớp CHÍNH XÁC chuỗi trong DB — FE, mock và BE dùng chung
 * một nguồn để không lệch nhau.
 */

// ===== Vai trò & trạng thái người dùng =====

export const USER_ROLES = ['customer', 'owner', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended', 'pending'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUTH_PROVIDERS = ['google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const TOKEN_TYPES = ['email_verify', 'password_reset'] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

// ===== Hồ sơ chủ sân =====

export const OWNER_APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type OwnerApplicationStatus = (typeof OWNER_APPLICATION_STATUSES)[number];

// ===== Danh mục =====

export const AREA_TYPES = ['province', 'district'] as const;
export type AreaType = (typeof AREA_TYPES)[number];

// ===== Cơ sở & sân con =====

export const VENUE_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
export type VenueStatus = (typeof VENUE_STATUSES)[number];

export const COURT_STATUSES = ['active', 'inactive'] as const;
export type CourtStatus = (typeof COURT_STATUSES)[number];

// ===== Đặt sân =====

export const BOOKING_SOURCES = ['online', 'manual'] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const BOOKING_STATUSES = [
  'held',
  'pending_payment',
  'confirmed',
  'completed',
  'cancelled',
  'expired',
  'no_show',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Trạng thái slot trên lưới giờ — ĐÚNG 5 giá trị API trả về.
 *
 * KHÁC với `BookingStatus`: đây là trạng thái hiển thị của một ô 30 phút,
 * tổng hợp từ booking + blackout + giờ mở cửa + thời điểm hiện tại.
 * Nguồn: docs/07-design-system.md (mục "Cấu hình Tailwind", khoá `slot`).
 */
export const SLOT_STATUSES = ['available', 'held', 'booked', 'blocked', 'past'] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

/**
 * Khoá màu hiển thị của một ô slot — gồm 5 trạng thái API cộng `my_hold`.
 *
 * `my_hold` KHÔNG phải giá trị API: giao diện suy ra từ
 * `status === 'held' && mine === true` để phân biệt "người khác đang giữ chỗ"
 * với "chính mình đang giữ chỗ". Nguồn: docs/07-design-system.md.
 */
export const SLOT_DISPLAY_KEYS = [...SLOT_STATUSES, 'my_hold'] as const;
export type SlotDisplayKey = (typeof SLOT_DISPLAY_KEYS)[number];

/** Suy ra khoá màu hiển thị từ trạng thái API + cờ sở hữu. */
export function slotDisplayKey(status: SlotStatus, mine?: boolean): SlotDisplayKey {
  return status === 'held' && mine ? 'my_hold' : status;
}

// ===== Thanh toán =====

export const PAYMENT_PROVIDERS = ['bank_transfer', 'cash'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'submitted',
  'completed',
  'rejected',
  'refunded',
  'cancelled',
  'expired',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ===== Thông báo & kiểm toán =====

export const NOTIFICATION_TYPES = [
  'booking_created',
  'booking_confirmed',
  'booking_cancelled',
  'payment_submitted',
  'payment_rejected',
  'hold_expired',
  'review_reply',
  'owner_application_approved',
  'owner_application_rejected',
  'venue_approved',
  'venue_rejected',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ===== Sự kiện realtime (Socket.IO) =====

export const SOCKET_EVENTS = {
  JOIN_VENUE: 'join_venue',
  LEAVE_VENUE: 'leave_venue',
  SLOT_UPDATED: 'slot_updated',
  HOLD_EXPIRED: 'hold_expired',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_CREATED: 'booking_created',
  PAYMENT_SUBMITTED: 'payment_submitted',
  PAYMENT_REJECTED: 'payment_rejected',
  NOTIFICATION_CREATED: 'notification_created',
} as const;
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

// ===== Mã lỗi API =====

/**
 * Mã lỗi chuẩn — nguồn: docs/11-api-contract.md (bảng mã lỗi).
 *
 * LƯU Ý: tài liệu có mâu thuẫn. Bảng mã lỗi liệt kê `BOOKING_CONFLICT`, còn
 * changelog 00-README.md (2026-10-12) và docs/05, docs/12 lại chốt `SLOT_TAKEN`
 * cho trường hợp hai người tranh cùng một slot. FE chấp nhận CẢ HAI cho tới khi
 * tài liệu thống nhất — xem `SLOT_CONFLICT_CODES` bên dưới.
 */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',
  SLOT_TAKEN: 'SLOT_TAKEN',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  CONFLICT_WITH_EXISTING_BOOKING: 'CONFLICT_WITH_EXISTING_BOOKING',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RESOURCE_IN_USE: 'RESOURCE_IN_USE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  HOLD_EXPIRED: 'HOLD_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** Hai mã cùng nghĩa "slot vừa bị người khác lấy" — FE phải bắt cả hai. */
export const SLOT_CONFLICT_CODES: readonly string[] = [
  API_ERROR_CODES.SLOT_TAKEN,
  API_ERROR_CODES.BOOKING_CONFLICT,
];

// ===== Quy tắc nghiệp vụ =====

/** Độ dài một block đặt sân (phút) — docs/05-booking-and-realtime.md. */
export const SLOT_MINUTES = 30;

/** Thời gian giữ chỗ trước khi tự trả slot (phút) — docs/05. */
export const HOLD_MINUTES = 10;

/** Giới hạn upload ảnh biên lai — docs/11-api-contract.md. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Định dạng ngày dùng cho query `date` của lưới slot. */
export const DATE_FORMAT = 'yyyy-MM-dd';
