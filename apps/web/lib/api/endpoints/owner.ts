import type {
  BankAccountInfo,
  Blackout,
  Booking,
  BookingDetail,
  BookingStatus,
  CancellationPolicy,
  Court,
  OpeningHour,
  OccupancyReport,
  OwnerApplication,
  OwnerApplicationInput,
  OwnerTimelineDay,
  Payment,
  PaymentStatus,
  PricingRule,
  RevenueReport,
  Review,
  ReviewReportStatus,
  VenueDetail,
  VenueImage,
} from '@bsc/shared';

import { apiFetch, apiFetchWithMeta, jsonBody } from '../client';
import { ApiError } from '../errors';
import { optimizeVenueImage } from '@/lib/utils/optimize-venue-image';

/**
 * Endpoint module – Kênh chủ sân.
 * Khớp `mocks/handlers/owner.ts` và `docs/11-api-contract.md` mục Owner.
 *
 * Mọi route ở đây đều nằm sau guard vai trò: khách thường nhận 403. UI không
 * cần tự chặn — cứ để lỗi nổi lên và render `ErrorState`.
 */

// ── Cơ sở & sân con ────────────────────────────────────────────────────────

export async function listOwnerVenues(): Promise<VenueDetail[]> {
  const data = await apiFetch<Array<Record<string, unknown>>>('/owner/venues');
  if (!Array.isArray(data)) return [];
  return data.map((v) => {
    const rawSports = Array.isArray(v.sports) ? v.sports : [];
    const sportIds = Array.isArray(v.sportIds) ? (v.sportIds as string[]) : [];
    const sportsList =
      rawSports.length > 0
        ? rawSports
        : sportIds.map((id) => ({ id, name: id, slug: id }));
    return {
      ...v,
      sports: sportsList,
      courts: Array.isArray(v.courts) ? v.courts : [],
      ratingAvg: typeof v.ratingAvg === 'number' ? v.ratingAvg : 0,
      reviewCount: typeof v.reviewCount === 'number' ? v.reviewCount : 0,
      coverUrl: typeof v.coverUrl === 'string' ? v.coverUrl : null,
      images: Array.isArray(v.images) ? v.images : [],
    } as unknown as VenueDetail;
  });
}

export function createOwnerVenue(input: {
  name: string;
  address: string;
  provinceId: string;
  provinceCode?: string;
  wardId?: string;
  wardCode?: string;
  districtId?: string;
  sportIds: string[];
  amenityIds?: string[];
  description?: string;
  lat: number;
  lng: number;
  ownerId?: string;
}) {
  return apiFetch<VenueDetail>('/venues', { method: 'POST', ...jsonBody(input) });
}

export function updateOwnerVenue(
  id: string,
  input: Partial<Pick<VenueDetail, 'name' | 'address' | 'provinceId' | 'wardId' | 'districtId' | 'description' | 'lat' | 'lng'>> & {
    provinceCode?: string;
    wardCode?: string;
    sportIds?: string[];
    amenityIds?: string[];
    ownerId?: string;
  },
) {
  return apiFetch<VenueDetail>(`/venues/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    ...jsonBody(input),
  });
}

export function deleteVenue(id: string) {
  return apiFetch<void>(`/venues/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function uploadVenueImage(venueId: string, image: File) {
  const optimizedImage = await optimizeVenueImage(image);
  const formData = new FormData();
  formData.append('file', optimizedImage);
  return apiFetch<Pick<VenueImage, 'id' | 'url'>>(
    `/venues/${encodeURIComponent(venueId)}/images`,
    { method: 'POST', body: formData },
  );
}

export function createCourt(
  venueId: string,
  input: { name: string; sportId: string; description?: string },
) {
  return apiFetch<Court>(`/venues/${encodeURIComponent(venueId)}/courts`, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function deleteCourt(courtId: string) {
  return apiFetch<{ success: true }>(`/courts/${encodeURIComponent(courtId)}`, {
    method: 'DELETE',
  });
}

// ── Giờ mở cửa ─────────────────────────────────────────────────────────────

export function getCourtOpeningHours(courtId: string) {
  return apiFetch<OpeningHour[]>(`/courts/${encodeURIComponent(courtId)}/opening-hours`);
}

export function replaceCourtOpeningHours(
  courtId: string,
  hours: Omit<OpeningHour, 'id' | 'venueId'>[],
) {
  return apiFetch<OpeningHour[]>(`/courts/${encodeURIComponent(courtId)}/opening-hours`, {
    method: 'PUT',
    ...jsonBody({ hours }),
  });
}

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

export function listCourtPricingRules(courtId: string) {
  return apiFetch<PricingRule[]>(`/courts/${encodeURIComponent(courtId)}/pricing-rules`);
}

export function createCourtPricingRule(
  courtId: string,
  input: Omit<PricingRule, 'id' | 'venueId'>,
) {
  return apiFetch<PricingRule>(`/courts/${encodeURIComponent(courtId)}/pricing-rules`, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function updateCourtPricingRule(
  courtId: string,
  ruleId: string,
  input: Partial<Omit<PricingRule, 'id' | 'venueId'>>,
) {
  return apiFetch<PricingRule>(
    `/courts/${encodeURIComponent(courtId)}/pricing-rules/${encodeURIComponent(ruleId)}`,
    {
      method: 'PATCH',
      ...jsonBody(input),
    },
  );
}

export function deleteCourtPricingRule(courtId: string, ruleId: string) {
  return apiFetch<{ success: true }>(
    `/courts/${encodeURIComponent(courtId)}/pricing-rules/${encodeURIComponent(ruleId)}`,
    {
      method: 'DELETE',
    },
  );
}

export function listPricingRules(venueId: string) {
  return apiFetch<PricingRule[]>(`/owner/venues/${encodeURIComponent(venueId)}/pricing-rules`);
}

export function createPricingRule(
  venueId: string,
  input: Omit<PricingRule, 'id' | 'venueId'>,
) {
  if (input.courtId) {
    return createCourtPricingRule(input.courtId, input);
  }
  return apiFetch<PricingRule>(`/owner/venues/${encodeURIComponent(venueId)}/pricing-rules`, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function deletePricingRule(ruleId: string, courtId?: string | null) {
  if (courtId) {
    return deleteCourtPricingRule(courtId, ruleId);
  }
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

export async function listOwnerPayments(
  params: { page?: number; limit?: number; status?: PaymentStatus | 'all' } = {},
) {
  const res = await apiFetchWithMeta<Array<Record<string, unknown>>>(
    '/owner/payments',
    { query: { ...params } },
  );
  const data = (res.data ?? []).map((p) => {
    const bookingStart = (p.bookingStart as string) || '';
    const bookingEnd = (p.bookingEnd as string) || '';
    const rawBooking = (p.booking as Record<string, unknown>) || {};
    const during = (rawBooking.during as { start: string; end: string }) || {
      start: bookingStart || (rawBooking.start as string) || '',
      end: bookingEnd || (rawBooking.end as string) || '',
    };
    return {
      id: p.id,
      bookingId: p.bookingId,
      amount: Number(p.amount) || 0,
      provider: p.provider,
      transferCode: (p.transferCode as string) ?? null,
      proofUrl: (p.proofUrl as string) ?? null,
      proofUploadedAt: (p.proofUploadedAt as string) ?? null,
      status: p.status,
      rejectReason: (p.rejectReason as string) ?? null,
      booking: {
        id: (rawBooking.id as string) || (p.bookingId as string),
        during,
        status:
          (rawBooking.status as BookingStatus) ||
          (p.bookingStatus as BookingStatus) ||
          'confirmed',
        totalPrice:
          Number(rawBooking.totalPrice ?? p.bookingTotalPrice) ||
          Number(p.amount) ||
          0,
        courtName:
          (rawBooking.courtName as string) ||
          (p.courtName as string) ||
          'Sân thi đấu',
        venueName:
          (rawBooking.venueName as string) ||
          (p.venueName as string) ||
          'Cơ sở',
        customerName:
          (rawBooking.customerName as string) ||
          (p.customerName as string) ||
          'Khách hàng',
        customerPhone:
          (rawBooking.customerPhone as string) ??
          (p.customerPhone as string) ??
          null,
      },
    } as OwnerPaymentItem;
  });
  return { data, meta: res.meta };
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

export async function listOwnerBookings(
  params: {
    page?: number;
    limit?: number;
    status?: BookingStatus;
    q?: string;
    venueId?: string;
    courtId?: string;
    from?: string;
    to?: string;
  } = {},
) {
  const res = await apiFetchWithMeta<Array<Record<string, unknown>>>(
    '/owner/bookings',
    { query: { ...params } },
  );
  const data = (res.data ?? []).map((b) => {
    const start =
      (b.start as string) ||
      (b.during as { start?: string })?.start ||
      '';
    const end =
      (b.end as string) ||
      (b.during as { end?: string })?.end ||
      '';
    return {
      ...b,
      during: { start, end },
      courtName: (b.courtName as string) || 'Sân thi đấu',
      customerName:
        (b.customerName as string) ||
        (b.guestName as string) ||
        'Khách hàng',
      customerPhone:
        (b.customerPhone as string) ?? (b.guestPhone as string) ?? null,
      paymentStatus: (b.paymentStatus as PaymentStatus) ?? null,
    } as unknown as OwnerBookingItem;
  });
  return { data, meta: res.meta };
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

/**
 * Đánh dấu khách không đến nhận sân (OWN-09).
 * Chuyển trạng thái đơn từ `confirmed` sang `no_show`.
 */
export function markBookingNoShow(bookingId: string) {
  return apiFetch<Booking>(`/bookings/${encodeURIComponent(bookingId)}/no-show`, {
    method: 'PATCH',
  });
}

// ── Doanh thu & đánh giá ───────────────────────────────────────────────────

export interface OwnerReview extends Review {
  venueName?: string;
  courtName?: string;
  customerName?: string;
  reportStatus?: ReviewReportStatus;
  reportReason?: string | null;
  reportImageUrl?: string | null;
  reportedAt?: string | null;
}

export function getRevenue(params: {
  from: string;
  to: string;
  groupBy?: 'day' | 'week' | 'month';
  venueId?: string;
  courtId?: string;
}) {
  return apiFetch<RevenueReport>('/owner/reports/revenue', {
    query: { ...params },
  });
}

export function getOccupancy(params: {
  from: string;
  to: string;
  venueId?: string;
  courtId?: string;
  compareWith?: 'previous';
}) {
  return apiFetch<OccupancyReport>('/owner/reports/occupancy', { query: { ...params } });
}

export async function listOwnerReviews(
  params: {
    page?: number;
    limit?: number;
    replied?: boolean;
    venueId?: string;
  } = {},
) {
  const res = await apiFetchWithMeta<Array<Record<string, unknown>>>(
    '/owner/reviews',
    { query: { ...params } },
  );
  const data = (res.data ?? []).map((r) => {
    return {
      ...r,
      customerName:
        (r.customerName as string) ||
        ((r.customer as { fullName?: string })?.fullName) ||
        'Khách hàng',
      comment: (r.comment as string) || (r.content as string) || '',
      reportStatus: (r.reportStatus as ReviewReportStatus | undefined) ?? 'none',
      reportReason: (r.reportReason as string | null | undefined) ?? null,
      reportImageUrl: (r.reportImageUrl as string | null | undefined) ?? null,
      reportedAt: (r.reportedAt as string | null | undefined) ?? null,
    } as unknown as OwnerReview;
  });
  return { data, meta: res.meta };
}

export function replyToReview(id: string, reply: string) {
  return apiFetch<Review>(`/owner/reviews/${encodeURIComponent(id)}/reply`, {
    method: 'PATCH',
    ...jsonBody({ ownerReply: reply }),
  });
}

export function reportReview(
  id: string,
  input: { reason: string; file?: File | null; imageUrl?: string | null },
) {
  if (input.file) {
    const form = new FormData();
    form.append('reason', input.reason);
    form.append('file', input.file);
    return apiFetch<OwnerReview>(`/owner/reviews/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      body: form,
    });
  }
  return apiFetch<OwnerReview>(`/owner/reviews/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    ...jsonBody({
      reason: input.reason,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    }),
  });
}

// ── Tài khoản nhận tiền & chính sách ───────────────────────────────────────

export function getBankAccount(venueId: string) {
  return apiFetch<BankAccountInfo | null>(
    `/owner/venues/${encodeURIComponent(venueId)}/payment-account`,
  );
}

export function updateBankAccount(venueId: string, input: BankAccountInfo) {
  return apiFetch<BankAccountInfo>(
    `/owner/venues/${encodeURIComponent(venueId)}/payment-account`,
    { method: 'PUT', ...jsonBody(input) },
  );
}

export function getCancellationPolicy(venueId: string) {
  return apiFetch<CancellationPolicy | null>(
    `/owner/venues/${encodeURIComponent(venueId)}/cancellation-policy`,
  );
}

export function updateCancellationPolicy(venueId: string, input: CancellationPolicy) {
  return apiFetch<CancellationPolicy>(
    `/owner/venues/${encodeURIComponent(venueId)}/cancellation-policy`,
    { method: 'PUT', ...jsonBody(input) },
  );
}

// ── Đăng ký làm chủ sân ────────────────────────────────────────────────────

export function submitOwnerApplication(input: OwnerApplicationInput) {
  return apiFetch<OwnerApplication>('/owner-applications', { method: 'POST', ...jsonBody(input) });
}

/** `null` khi chưa từng nộp — UI hiện form trống thay vì lỗi. */
export function getMyOwnerApplication() {
  return apiFetch<OwnerApplication | null>('/owner-applications/me').catch((err) => {
    if (err instanceof ApiError && (err.status === 404 || err.code === 'NOT_FOUND')) {
      return null;
    }
    throw err;
  });
}
