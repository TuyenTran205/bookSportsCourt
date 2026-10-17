/**
 * Zod schema — nguồn xác thực DUY NHẤT dùng chung cho form FE và (sau này) BE.
 *
 * docs/12-coding-standards.md: "đặt schema ở packages/shared, tránh viết validate
 * hai lần và lệch nhau". Form dùng `zodResolver`, mock MSW dùng lại chính schema
 * này để trả lỗi 422 giống BE thật.
 */

import { z } from 'zod';
import {
  API_ERROR_CODES,
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  SLOT_MINUTES,
  UPLOAD_ACCEPTED_TYPES,
  UPLOAD_MAX_BYTES,
  USER_ROLES,
  USER_STATUSES,
  VENUE_STATUSES,
} from './constants';

// ===== Nguyên thuỷ dùng lại nhiều nơi =====

export const uuidSchema = z.string().uuid('ID không hợp lệ');

export const emailSchema = z
  .string()
  .min(1, 'Vui lòng nhập email')
  .email('Email không hợp lệ')
  .max(255, 'Email quá dài')
  .toLowerCase()
  .trim();

/**
 * Số điện thoại Việt Nam: 10 số, bắt đầu bằng 0.
 * Chấp nhận cả dạng có khoảng trắng/gạch nối, chuẩn hoá trước khi kiểm.
 */
export const phoneSchema = z
  .string()
  .min(1, 'Vui lòng nhập số điện thoại')
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .refine((v) => /^0\d{9}$/.test(v), 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0');

export const optionalPhoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .refine((v) => v === '' || /^0\d{9}$/.test(v), 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0')
  .optional();

/**
 * Mật khẩu tối thiểu 8 ký tự.
 *
 * LƯU Ý: tài liệu chưa chốt độ dài tối thiểu (docs/06 chỉ nói băm Argon2id).
 * 8 ký tự là mặc định an toàn; nếu chốt khác, sửa DUY NHẤT ở đây.
 */
export const passwordSchema = z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự');

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD');

export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Một block đặt sân — phút phải chia hết cho SLOT_MINUTES. */
export const slotTimeSchema = z.object({
  start: isoDateTimeSchema,
  end: isoDateTimeSchema,
});

// ===== Auth =====

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Vui lòng nhập họ tên').max(100, 'Họ tên quá dài').trim(),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Thiếu token đặt lại mật khẩu'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });

// ===== Người dùng =====

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Vui lòng nhập họ tên').max(100).trim(),
  phone: optionalPhoneSchema,
  avatarUrl: z.string().url('URL ảnh không hợp lệ').nullish(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
});

// ===== Tìm kiếm sân =====

export const venueSortSchema = z.enum(['price_asc', 'price_desc', 'rating_desc', 'newest']);

export const venueSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  provinceId: uuidSchema.optional(),
  districtId: uuidSchema.optional(),
  sportIds: z.array(uuidSchema).optional(),
  amenityIds: z.array(uuidSchema).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  date: dateOnlySchema.optional(),
  sort: venueSortSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ===== Đặt sân =====

/**
 * `POST /bookings/hold`.
 *
 * `idempotencyKey` để bấm hai lần không tạo hai hold — docs/11-api-contract.md
 * mục Idempotency: cùng user gửi lại cùng key → trả 200 kèm hold cũ.
 */
export const createHoldSchema = z.object({
  courtId: uuidSchema,
  slots: z
    .array(slotTimeSchema)
    .min(1, 'Vui lòng chọn ít nhất một khung giờ')
    .max(16, 'Tối đa 16 khung giờ mỗi lượt đặt'),
  idempotencyKey: z.string().min(1).max(128),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

/** Booking tại quầy do Owner tạo (`source: 'manual'`) — có thể không gắn tài khoản. */
export const createManualBookingSchema = z.object({
  courtId: uuidSchema,
  slots: z.array(slotTimeSchema).min(1, 'Vui lòng chọn ít nhất một khung giờ'),
  guestName: z.string().min(2, 'Vui lòng nhập tên khách').max(100).trim(),
  guestPhone: phoneSchema,
  note: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500, 'Lý do tối đa 500 ký tự').optional(),
});

/** Hình dạng tối thiểu của một `File` trình duyệt — không phụ thuộc lib DOM. */
interface BrowserFile {
  type: string;
  size: number;
}

function isBrowserFile(value: unknown): value is BrowserFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as BrowserFile).type === 'string' &&
    typeof (value as BrowserFile).size === 'number'
  );
}

/**
 * Ảnh biên lai — kiểm cả loại và kích thước trước khi gửi.
 *
 * Không dùng `z.instanceof(File)`: package này còn được backend dùng chung, mà
 * `File` chỉ tồn tại ở trình duyệt. Kiểm theo cấu trúc nên chạy được ở cả hai
 * môi trường; phía server vẫn nên xác thực lại bằng multer.
 */
export const proofUploadSchema = z.object({
  file: z
    .custom<BrowserFile>(isBrowserFile, {
      message: 'Vui lòng chọn ảnh biên lai',
    })
    .refine((f) => (UPLOAD_ACCEPTED_TYPES as readonly string[]).includes(f.type), 'Chỉ nhận ảnh JPG, PNG hoặc WebP')
    .refine((f) => f.size <= UPLOAD_MAX_BYTES, 'Ảnh tối đa 5MB'),
});

// ===== Đánh giá =====

export const createReviewSchema = z.object({
  bookingId: uuidSchema,
  rating: z.coerce.number().int().min(1, 'Vui lòng chọn số sao').max(5),
  comment: z.string().max(2000, 'Nội dung tối đa 2000 ký tự').optional(),
});

export const replyReviewSchema = z.object({
  ownerReply: z.string().trim().min(1, 'Vui lòng nhập nội dung trả lời').max(2000, 'Nội dung tối đa 2000 ký tự'),
});

// ===== Owner: cơ sở, sân con, giá, khoá sân =====

export const createVenueSchema = z.object({
  name: z.string().min(2, 'Vui lòng nhập tên cơ sở').max(200).trim(),
  description: z.string().max(5000).optional(),
  address: z.string().min(5, 'Vui lòng nhập địa chỉ').max(500).trim(),
  provinceId: uuidSchema,
  districtId: uuidSchema,
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  amenityIds: z.array(uuidSchema).default([]),
});

export const createCourtSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên sân').max(100).trim(),
  description: z.string().max(1000).optional(),
  sportId: uuidSchema.nullish(),
});

export const openingHourSchema = z
  .object({
    /** 0 = Chủ nhật … 6 = Thứ bảy. */
    weekday: z.coerce.number().int().min(0).max(6),
    openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ phải theo định dạng HH:mm'),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ phải theo định dạng HH:mm'),
    isClosed: z.boolean().default(false),
  })
  .refine((d) => d.isClosed || d.openTime < d.closeTime, {
    message: 'Giờ đóng cửa phải sau giờ mở cửa',
    path: ['closeTime'],
  });

export const pricingRuleSchema = z
  .object({
    label: z.string().min(1, 'Vui lòng nhập tên khung giá').max(100).trim(),
    /** 0 = Chủ nhật … 6 = Thứ bảy. */
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, 'Chọn ít nhất một ngày'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ phải theo định dạng HH:mm'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ phải theo định dạng HH:mm'),
    /** VND cho mỗi block SLOT_MINUTES. */
    pricePerSlot: z.coerce.number().int().nonnegative('Giá không được âm'),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
    path: ['endTime'],
  });

export const blackoutSchema = z
  .object({
    start: isoDateTimeSchema,
    end: isoDateTimeSchema,
    reason: z.string().max(500).optional(),
  })
  .refine((d) => new Date(d.start) < new Date(d.end), {
    message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu',
    path: ['end'],
  });

export const bankAccountSchema = z.object({
  bankBin: z.string().min(6, 'Vui lòng chọn ngân hàng').max(20),
  bankName: z.string().min(1, 'Vui lòng nhập tên ngân hàng').max(200).trim(),
  accountNo: z
    .string()
    .min(6, 'Số tài khoản quá ngắn')
    .max(30, 'Số tài khoản quá dài')
    .regex(/^\d+$/, 'Số tài khoản chỉ gồm chữ số'),
  accountName: z.string().min(2, 'Vui lòng nhập tên chủ tài khoản').max(200).trim(),
});

const policyNumber = (max: number, maxMessage: string) =>
  z.preprocess(
    (value) =>
      typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
        ? value
        : Number.NaN,
    z.coerce
      .number({ invalid_type_error: 'Vui lòng nhập số hợp lệ.' })
      .int('Vui lòng nhập số nguyên.')
      .min(0, 'Giá trị tối thiểu là 0.')
      .max(max, maxMessage),
  );

export const cancellationPolicySchema = z.object({
  cancelBeforeHours: policyNumber(720, 'Số giờ không thể vượt quá 720.'),
  refundPercent: policyNumber(100, 'Tỷ lệ hoàn tiền không thể vượt quá 100%.'),
  depositPercent: policyNumber(100, 'Tỷ lệ đặt cọc không thể vượt quá 100%.'),
});

// ===== Owner: đăng ký làm chủ sân =====

export const ownerApplicationSchema = z.object({
  businessName: z.string().min(2, 'Vui lòng nhập tên cơ sở kinh doanh').max(200).trim(),
  phone: phoneSchema,
  address: z.string().min(5, 'Vui lòng nhập địa chỉ cơ sở').max(500).trim(),
  taxCode: z
    .string()
    .regex(/^(?:\d{10}|\d{12}|\d{13})$/, 'MST gồm 10 hoặc 13 chữ số, CCCD gồm 12 chữ số')
    .optional(),
  bankBin: z.string().min(6, 'Vui lòng chọn ngân hàng').max(20),
  bankName: z.string().min(1, 'Vui lòng chọn ngân hàng').max(200).trim(),
  accountNo: z
    .string()
    .min(6, 'Số tài khoản quá ngắn')
    .max(30, 'Số tài khoản quá dài')
    .regex(/^\d+$/, 'Số tài khoản chỉ gồm chữ số'),
  accountName: z.string().min(2, 'Vui lòng nhập tên chủ tài khoản').max(200).trim(),
  note: z.string().max(2000, 'Giới thiệu tối đa 2.000 ký tự').optional(),
  idCardUrl: z.string().url('Đường dẫn giấy tờ không hợp lệ').optional(),
});

export const rejectSchema = z.object({
  rejectReason: z.string().min(5, 'Vui lòng nhập lý do từ chối (ít nhất 5 ký tự)').max(500, 'Lý do tối đa 500 ký tự'),
});

// ===== Admin: danh mục =====

export const sportSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên môn').max(100).trim(),
  slug: z
    .string()
    .min(1, 'Vui lòng nhập slug')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch nối'),
  icon: z.string().max(50).optional(),
});

export const amenitySchema = sportSchema;

export const areaSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên khu vực').max(100).trim(),
  slug: z
    .string()
    .min(1, 'Vui lòng nhập slug')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch nối'),
  type: z.enum(['province', 'district']),
  parentId: uuidSchema.nullish(),
});

export const venueModerationSchema = z.object({
  status: z.enum(VENUE_STATUSES),
  reason: z.string().max(500).optional(),
});

// ===== Bộ lọc danh sách dùng chung cho bảng quản trị =====

export const tableQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().max(100).optional(),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const bookingFilterSchema = tableQuerySchema.extend({
  status: z.enum(BOOKING_STATUSES).optional(),
  venueId: uuidSchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export const paymentFilterSchema = tableQuerySchema.extend({
  status: z.enum(PAYMENT_STATUSES).optional(),
  venueId: uuidSchema.optional(),
});

// ===== Suy ra kiểu TypeScript từ schema =====

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type VenueSearchInput = z.infer<typeof venueSearchSchema>;
export type CreateHoldInput = z.infer<typeof createHoldSchema>;
export type CreateManualBookingInput = z.infer<typeof createManualBookingSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReplyReviewInput = z.infer<typeof replyReviewSchema>;
export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type CreateCourtInput = z.infer<typeof createCourtSchema>;
export type OpeningHourInput = z.infer<typeof openingHourSchema>;
export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;
export type BlackoutInput = z.infer<typeof blackoutSchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
export type CancellationPolicyInput = z.infer<typeof cancellationPolicySchema>;
export type OwnerApplicationInput = z.infer<typeof ownerApplicationSchema>;
export type SportInput = z.infer<typeof sportSchema>;
export type AreaInput = z.infer<typeof areaSchema>;
export type TableQueryInput = z.infer<typeof tableQuerySchema>;
export type BookingFilterInput = z.infer<typeof bookingFilterSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;

export { API_ERROR_CODES, SLOT_MINUTES };
