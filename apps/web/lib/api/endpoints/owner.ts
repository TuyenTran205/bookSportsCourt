import type {
  BankAccountInfo,
  Blackout,
  Booking,
  BookingDetail,
  BookingStatus,
  CancellationPolicy,
  Court,
  OpeningHour,
  OwnerApplication,
  OwnerApplicationInput,
  OwnerTimelineDay,
  Payment,
  PaymentStatus,
  PricingRule,
  Review,
  RevenuePoint,
  RevenueSummary,
  VenueDetail,
} from '@bsc/shared';

import { apiFetch, apiFetchWithMeta, jsonBody } from '../client';

/**
 * Endpoint module – Kênh chủ sân.
 * Khớp `mocks/handlers/owner.ts` và `docs/11-api-contract.md` mục Owner.
 *
 * Mọi route ở đây đều nằm sau guard vai trò: khách thường nhận 403. UI không
 * cần tự chặn — cứ để lỗi nổi lên và render `ErrorState`.
 */

// ── Cơ sở & sân con ────────────────────────────────────────────────────────

export function listOwnerVenues() {
  return apiFetch<VenueDetail[]>('/owner/venues');
}

export function createOwnerVenue(input: {
  name: string;
  address: string;
  provinceId: string;
  districtId: string;
  sportIds: string[];
  description?: string;
  lat?: number;
  lng?: number;
}) {
  return apiFetch<VenueDetail>('/owner/venues', { method: 'POST', ...jsonBody(input) });
}

export function updateOwnerVenue(id: string, input: Partial<VenueDetail>) {
  return apiFetch<VenueDetail>(`/owner/venues/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    ...jsonBody(input),
  });
}

export function createCourt(
  venueId: string,
  input: { name: string; sportId: string; description?: string },
) {
  return apiFetch<Court>(`/owner/venues/${encodeURIComponent(venueId)}/courts`, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function deleteCourt(courtId: string) {
  return apiFetch<{ success: true }>(`/owner/courts/${encodeURIComponent(courtId)}`, {
    method: 'DELETE',
  });
}

// ── Giờ mở cửa ─────────────────────────────────────────────────────────────

export function getOpeningHours(venueId: string) {
  return apiFetch<OpeningHour[]>(`/owner/venues/${encodeURIComponent(venueId)}/opening-hours`);
}

/** Gửi TOÀN BỘ tuần một lượt — server thay thế, không merge từng dòng. */
export function replaceOpeningHours(venueId: string, hours: Omit<OpeningHour, 'id' | 'venueId'>[]) {
  return apiFetch<OpeningHour[]>(`/owner/venues/${encodeURIComponent(venueId)}/opening-hours`, {
    method: 'PUT',
    ...jsonBody({ hours }),
  });
}

// ── Bảng giá ───────────────────────────────────────────────────────────────

export function listPricingRules(venueId: string) {
  return apiFetch<PricingRule[]>(`/owner/venues/${encodeURIComponent(venueId)}/pricing-rules`);
}

export function createPricingRule(
  venueId: string,
  input: Omit<PricingRule, 'id' | 'venueId'>,
) {
  return apiFetch<PricingRule>(`/owner/venues/${encodeURIComponent(venueId)}/pricing-rules`, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function deletePricingRule(ruleId: string) {
  return apiFetch<{ success: true }>(`/owner/pricing-rules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
  });
}

// ── Khoá sân ───────────────────────────────────────────────────────────────

export function listBlackouts(courtId: string) {
  return apiFetch<Blackout[]>(`/courts/${encodeURIComponent(courtId)}/blackouts`);
}

export function createBlackout(courtId: string, input: { start: string; end: string; reason?: string }) {
  return apiFetch<Blackout>(`/courts/${encodeURIComponent(courtId)}/blackouts`, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function deleteBlackout(courtId: string, blackoutId: string) {
  return apiFetch<{ success: true }>(
    `/courts/${encodeURIComponent(courtId)}/blackouts/${encodeURIComponent(blackoutId)}`,
    {
      method: 'DELETE',
    },
  );
}

// ── Thanh toán ─────────────────────────────────────────────────────────────

export interface OwnerPaymentItem {
  id: string;
  bookingId: string;
  amount: number;
  provider: string;
  transferCode: string | null;
  proofUrl: string | null;
  proofUploadedAt: string | null;
  status: PaymentStatus;
  rejectReason?: string | null;
  booking: {
    id: string;
    during: { start: string; end: string };
    status: BookingStatus;
    totalPrice: number;
    courtName: string;
    venueName: string;
    customerName: string;
    customerPhone?: string | null;
  };
}

export function listOwnerPayments(
  params: { page?: number; limit?: number; status?: string } = {},
) {
  return apiFetchWithMeta<OwnerPaymentItem[]>('/owner/payments', { query: { ...params } });
}

/** Duyệt biên lai → booking chuyển sang `confirmed`. */
export function approvePayment(id: string) {
  return apiFetch<Payment>(`/owner/payments/${encodeURIComponent(id)}/approve`, {
    method: 'PATCH',
  });
}

export function rejectPayment(id: string, reason: string) {
  return apiFetch<Payment>(`/owner/payments/${encodeURIComponent(id)}/reject`, {
    method: 'PATCH',
    ...jsonBody({ reason }),
  });
}

// ── Lịch đặt ───────────────────────────────────────────────────────────────

export interface OwnerBookingItem extends Booking {
  courtName: string;
  customerName: string;
  customerPhone: string | null;
  paymentStatus: PaymentStatus | null;
}

export function listOwnerBookings(
  params: { page?: number; limit?: number; status?: BookingStatus; date?: string } = {},
) {
  return apiFetchWithMeta<OwnerBookingItem[]>('/owner/bookings', { query: { ...params } });
}

/**
 * Dữ liệu `OwnerTimeline` cho một ngày của một cơ sở (OWN-06).
 *
 * Trả cả sân, đơn, khoá sân và giờ mở cửa — không phải chỉ danh sách đơn.
 * Bắt buộc có `venueId`: lưới vẽ giờ mở cửa theo cơ sở, gộp nhiều cơ sở vào
 * một lưới sẽ ra trục thời gian sai.
 */
export function getOwnerTimeline(venueId: string, date: string) {
  return apiFetch<OwnerTimelineDay>('/owner/timeline', { query: { venueId, date } });
}

/** Đặt hộ khách tại quầy — không cần thanh toán trực tuyến. */
export function createManualBooking(input: {
  courtId: string;
  slots: Array<{ start: string; end: string }>;
  guestName: string;
  guestPhone?: string;
  note?: string;
}) {
  return apiFetch<BookingDetail>('/owner/bookings/manual', { method: 'POST', ...jsonBody(input) });
}

// ── Doanh thu & đánh giá ───────────────────────────────────────────────────

export function getRevenue(params: { days?: number; from?: string; to?: string; groupBy?: 'day' | 'month' } = {}) {
  return apiFetch<{ summary: RevenueSummary; series: RevenuePoint[]; points?: RevenuePoint[] }>('/owner/revenue', {
    query: { ...params },
  });
}

export function listOwnerReviews(params: { page?: number; limit?: number; replied?: boolean } = {}) {
  return apiFetchWithMeta<Review[]>('/owner/reviews', { query: { ...params } });
}

export function replyToReview(id: string, reply: string) {
  return apiFetch<Review>(`/owner/reviews/${encodeURIComponent(id)}/reply`, {
    method: 'PATCH',
    ...jsonBody({ reply }),
  });
}

// ── Tài khoản nhận tiền & chính sách ───────────────────────────────────────

export function getBankAccount() {
  return apiFetch<BankAccountInfo | null>('/owner/bank-account');
}

export function updateBankAccount(input: BankAccountInfo) {
  return apiFetch<BankAccountInfo>('/owner/bank-account', { method: 'PUT', ...jsonBody(input) });
}

export function updateCancellationPolicy(input: CancellationPolicy) {
  return apiFetch<CancellationPolicy>('/owner/cancellation-policy', {
    method: 'PUT',
    ...jsonBody(input),
  });
}

// ── Đăng ký làm chủ sân ────────────────────────────────────────────────────

export function submitOwnerApplication(input: OwnerApplicationInput) {
  return apiFetch<OwnerApplication>('/owner-applications', { method: 'POST', ...jsonBody(input) });
}

/** `null` khi chưa từng nộp — UI hiện form trống thay vì lỗi. */
export function getMyOwnerApplication() {
  return apiFetch<OwnerApplication | null>('/owner-applications/me');
}
