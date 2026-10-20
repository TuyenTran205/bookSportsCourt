/**
 * Kiểu dữ liệu dùng chung, phản chiếu CHÍNH XÁC shape JSON của API (camelCase).
 *
 * Nguồn: docs/11-api-contract.md (mục "Cấu trúc Response lồng nhau"),
 * docs/04-database-schema.md. Tên trường giữ nguyên như server trả về — không
 * đổi sang snake_case để tránh phải map lại ở tầng client.
 */

import type {
  AreaType,
  BookingSource,
  BookingStatus,
  CourtStatus,
  NotificationType,
  OwnerApplicationStatus,
  PaymentProvider,
  PaymentStatus,
  SlotStatus,
  UserRole,
  UserStatus,
  VenueStatus,
} from './constants';

// ===== Envelope chung =====

/** Metadata phân trang — chỉ xuất hiện ở endpoint danh sách. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Envelope thành công: mọi response 2xx đều bọc trong `data`. */
export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
}

/** Envelope lỗi: mọi response 4xx/5xx. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Lỗi theo từng trường, dùng để hiển thị dưới input trong form. */
    details?: Record<string, string[]> | undefined;
  };
}

// ===== Danh mục =====

export interface Province {
  id: string;
  name: string;
  slug: string;
}

export interface District extends Province {
  provinceId: string;
}

export interface Area {
  id: string;
  name: string;
  slug: string;
  type: AreaType;
  parentId: string | null;
}

export interface Sport {
  id: string;
  name: string;
  slug: string;
  /** Tên icon Lucide, ví dụ "activity". */
  icon: string | null;
}

export interface Amenity {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

// ===== Người dùng =====

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

/** Rút gọn, dùng trong danh sách admin. */
export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface OwnerProfile {
  id: string;
  userId: string;
  businessName: string;
  taxCode: string | null;
  status: OwnerApplicationStatus;
  rejectReason: string | null;
  createdAt: string;
}

export interface OwnerApplication {
  id: string;
  user: UserSummary;
  businessName: string;
  phone?: string;
  address?: string;
  taxCode: string | null;
  idCardUrl: string | null;
  bankBin?: string;
  bankName?: string;
  accountNo?: string;
  accountName?: string;
  note?: string | null;
  status: OwnerApplicationStatus;
  rejectReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ===== Cơ sở & sân con =====

export interface VenueImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface VenuePaymentAccount {
  id: string;
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}

export interface CancellationPolicy {
  /** Huỷ trước bao nhiêu giờ thì được hoàn. */
  cancelBeforeHours: number;
  /** % số tiền cọc được hoàn. */
  refundPercent: number;
  /** % giá trị booking phải cọc. */
  depositPercent: number;
}

export interface Court {
  id: string;
  name: string;
  description?: string | null;
  sportId: string | null;
  status: CourtStatus;
}

/** Mục trong danh sách tìm kiếm `GET /venues`. */
export interface VenueListItem {
  id: string;
  name: string;
  slug: string;
  address: string;
  province: Province | null;
  district: District | null;
  lat: number;
  lng: number;
  status: VenueStatus;
  coverUrl: string | null;
  ratingAvg: number;
  reviewCount: number;
  fromPrice: number;
  sports: Sport[];
}

/** Chi tiết đầy đủ `GET /venues/:slug`. */
export interface VenueDetail extends VenueListItem {
  ownerId: string;
  description: string | null;
  provinceId: string | null;
  districtId: string | null;
  images: VenueImage[];
  amenities: Amenity[];
  courts: Court[];
  cancellationPolicy: CancellationPolicy | null;
}

/** Giờ mở cửa theo thứ trong tuần. `courtId = null` nghĩa là áp cho cả cơ sở. */
export interface OpeningHour {
  id: string;
  venueId: string;
  courtId: string | null;
  /** 0 = Chủ nhật … 6 = Thứ bảy. */
  weekday: number;
  /** "HH:mm". */
  openTime: string;
  /** "HH:mm". */
  closeTime: string;
  isClosed: boolean;
}

/** Khung giá theo giờ và thứ. `pricePerSlot` là VND cho mỗi block 30 phút. */
export interface PricingRule {
  id: string;
  venueId: string;
  courtId: string | null;
  label: string;
  /** Các thứ áp dụng, 0 = Chủ nhật … 6 = Thứ bảy. */
  weekdays: number[];
  startTime: string;
  endTime: string;
  pricePerSlot: number;
}

/** Khoá sân (bảo trì, giữ chỗ nội bộ) — chặn đặt trong khoảng thời gian. */
export interface Blackout {
  id: string;
  courtId: string;
  start: string;
  end: string;
  reason: string | null;
  createdAt: string;
}

/** Điểm ghim trên bản đồ `GET /venues/map`. */
export interface VenueMapPoint {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  fromPrice: number;
  ratingAvg: number;
}

// ===== Lưới slot =====

/**
 * Một ô 30 phút trên lưới giờ.
 *
 * `mine = true` nghĩa là hold/booking đang thuộc về người dùng hiện tại —
 * giao diện phải phân biệt được "người khác giữ" và "chính mình giữ".
 */
export interface Slot {
  /** ISO 8601 kèm offset, ví dụ "2026-10-15T08:00:00+07:00". */
  start: string;
  end: string;
  status: SlotStatus;
  /** VND. */
  price: number;
  mine?: boolean;
}

export interface CourtSlots {
  courtId: string;
  slots: Slot[];
}

/** `GET /venues/:id/slots?date=YYYY-MM-DD` */
export interface SlotGridResponse {
  date: string;
  courts: CourtSlots[];
}

/** Payload sự kiện `slot_updated` — chỉ chứa ô vừa đổi, không gửi cả lưới. */
export interface SlotUpdatedPayload {
  venueId: string;
  courtId: string;
  date: string;
  slots: Array<Pick<Slot, 'start' | 'end' | 'status' | 'price'> & { mine?: boolean }>;
}

// ===== Đặt sân =====

/** Khoảng thời gian — khớp kiểu `TSTZRANGE` của DB. */
export interface TimeRange {
  start: string;
  end: string;
}

export interface BookingCourtVenueRef {
  id: string;
  name: string;
  slug: string;
  address: string;
}

export interface BookingCourtRef {
  id: string;
  name: string;
  venue: BookingCourtVenueRef;
}

export interface BookingCustomerRef {
  id: string;
  fullName: string;
  /** Đã che một phần, ví dụ "0912***456". */
  phone: string | null;
  email: string;
}

export interface Payment {
  id: string;
  amount: number;
  provider: PaymentProvider;
  transferCode: string | null;
  proofUrl: string | null;
  proofUploadedAt: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  reviewedBy: string | null;
  rejectReason?: string | null;
  refundAmount?: number | null;
}

export interface Review {
  id: string;
  bookingId: string;
  venueId: string;
  customerId: string;
  rating: number;
  comment: string | null;
  ownerReply: string | null;
  ownerRepliedAt: string | null;
  createdAt: string;
  customer?: Pick<UserSummary, 'id' | 'fullName' | 'avatarUrl'>;
}

export interface Booking {
  id: string;
  courtId: string;
  customerId: string | null;
  source: BookingSource;
  guestName: string | null;
  guestPhone: string | null;
  during: TimeRange;
  status: BookingStatus;
  totalPrice: number;
  depositAmount: number;
  note: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

/** Chi tiết đầy đủ `GET /bookings/:id` — lồng court/venue/customer/payment/review. */
export interface BookingDetail extends Booking {
  court: BookingCourtRef;
  customer: BookingCustomerRef | null;
  payment: Payment | null;
  review: Review | null;
}

/** Tài khoản nhận tiền của chủ sân trả kèm khi tạo hold, để FE tự dựng mã QR thanh toán từ số tiền và số tài khoản ngân hàng. */
export interface BankAccountInfo {
  bankBin: string;
  accountNo: string;
  accountName: string;
}

/** `POST /bookings/hold` — trả về booking vừa giữ kèm thông tin chuyển khoản. */
export interface HoldBookingResponse {
  booking: Booking;
  payment: {
    id: string;
    amount: number;
    transferCode: string;
    bankAccount: BankAccountInfo;
  };
}

// ===== Lịch sử & thống kê =====

export interface RevenueSummary {
  totalRevenue: number;
  totalBookings: number;
  from: string;
  to: string;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  bookings: number;
}

export interface RevenueReport {
  summary: RevenueSummary;
  series: RevenuePoint[];
}

export interface OccupancyPoint {
  date: string;
  occupancyRate: number;
  bookedSlots: number;
  availableSlots: number;
}

export interface PeakHour {
  startTime: string;
  endTime: string;
  bookedSlots: number;
}

export interface OccupancyReport {
  summary: {
    occupancyRate: number;
    bookedSlots: number;
    availableSlots: number;
    from: string;
    to: string;
    peakHours: PeakHour[];
  };
  series: OccupancyPoint[];
}

export interface OwnerTimelineBooking {
  id: string;
  courtId: string;
  during: TimeRange;
  status: BookingStatus;
  source: BookingSource;
  guestName: string | null;
  customerName: string | null;
  totalPrice: number;
}

/**
 * Toàn bộ dữ liệu một ngày cho `OwnerTimeline` — `GET /owner/timeline`
 * (docs/11, OWN-06).
 *
 * Gói đủ trong một response để lưới chỉ cần một lượt gọi: sân, đơn, khoá sân
 * và giờ mở cửa của đúng ngày đang xem.
 *
 * Phạm vi là **một cơ sở**: `courtWindow()` tra giờ mở cửa theo `courtId` và
 * dựa vào rule chung của cơ sở (`courtId: null`), nên trộn giờ của nhiều cơ sở
 * trong cùng một response sẽ khiến sân của cơ sở này nhận giờ của cơ sở kia.
 */
export interface OwnerTimelineDay {
  /** Ngày đang xem, dạng `YYYY-MM-DD`. */
  date: string;
  /** Cơ sở đang xem. */
  venueId: string;
  /** Sân con của cơ sở. */
  courts: Court[];
  bookings: OwnerTimelineBooking[];
  /** Khoá sân (bảo trì) đang áp dụng — vẽ ô `blocked`. */
  blackouts: Blackout[];
  /** Giờ mở cửa của cơ sở, cả tuần — lọc theo thứ khi dựng trục thời gian. */
  openingHours: OpeningHour[];
}

export interface DashboardStats {
  totalUsers: number;
  totalVenues: number;
  totalBookings: number;
  totalRevenue: number;
  pendingOwnerApplications: number;
  pendingVenues: number;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

// ===== Kết quả session (dùng cho middleware & auth) =====

/** Thông tin phiên tối thiểu mà middleware đọc từ cookie. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}
