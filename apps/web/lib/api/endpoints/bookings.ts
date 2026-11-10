import type {
  Booking,
  BookingDetail,
  BookingStatus,
  CreateHoldInput,
  CreateReviewInput,
  Payment,
  Review,
  VenueListItem,
} from '@bsc/shared';

import { apiFetch, apiFetchWithMeta, jsonBody } from '../client';

/** Một block 30 phút gửi lên API — khớp `slotTimeSchema`. */
type SlotTime = CreateHoldInput['slots'][number];

/**
 * Endpoint module – Bookings, thanh toán, đánh giá, yêu thích.
 * Khớp `docs/11-api-contract.md` mục 8 và `mocks/handlers/bookings.ts`.
 */

/** Payload trả về của `POST /bookings/hold` — dùng để dựng màn Checkout. */
export interface HoldResult {
  booking: Booking;
  /** Chỉ có ở `GET /bookings/hold/:id`; thời gian còn lại của lượt giữ chỗ (ms). */
  remainingMs?: number;
  payment: {
    id: string;
    amount: number;
    transferCode: string;
    bankAccount: {
      bankBin: string;
      accountNo: string;
      accountName: string;
    };
  };
}

/** Kết quả `POST /bookings/quote` — xem giá trước khi giữ chỗ. */
export interface QuoteResult {
  total: number;
  deposit: number;
  depositPercent: number;
  /** Các dải liên tiếp đã gộp, ví dụ `19:00–20:30`. */
  ranges: Array<{ start: string; end: string }>;
  /** `start` của những block vừa bị người khác lấy — hiện cảnh báo. */
  unavailable: string[];
}

export interface BookingListParams {
  page?: number;
  limit?: number;
  status?: BookingStatus;
}

/**
 * `POST /bookings/hold` — giữ chỗ tạm.
 *
 * `idempotencyKey` BẮT BUỘC: mạng chập chờn khiến người dùng bấm lại, không có
 * khoá này sẽ tạo hai hold cho cùng một lượt chọn.
 */
export function createHold(input: {
  courtId: string;
  slots: SlotTime[];
  idempotencyKey: string;
  note?: string;
}) {
  return apiFetch<HoldResult>('/bookings/hold', { method: 'POST', ...jsonBody(input) });
}

/** `GET /bookings/hold/:id` — đếm ngược và phát hiện hết hạn. */
export function getHold(id: string) {
  return apiFetch<HoldResult>(`/bookings/hold/${encodeURIComponent(id)}`);
}

/** `POST /bookings/quote` — tổng tiền + tiền cọc, không tạo gì ở server. */
export function quoteBooking(input: { courtId: string; slots: SlotTime[] }) {
  return apiFetch<QuoteResult>('/bookings/quote', { method: 'POST', ...jsonBody(input) });
}

/** `GET /bookings` — lịch sử của chính người dùng đang đăng nhập. */
export async function listMyBookings(params: BookingListParams = {}) {
  const res = await apiFetchWithMeta<Array<Record<string, unknown>>>(
    '/bookings',
    { query: { ...params } },
  );
  const data = (res.data ?? []).map((b) => {
    const rawCourt = (b.court as Record<string, unknown>) || {};
    const rawVenue = (rawCourt.venue as Record<string, unknown>) || {};
    const rawDuring = (b.during as { start?: string; end?: string }) || {};
    const start = (b.start as string) || rawDuring.start || '';
    const end = (b.end as string) || rawDuring.end || '';
    return {
      ...b,
      during: { start, end },
      court: {
        id: (rawCourt.id as string) || (b.courtId as string) || '',
        name:
          (rawCourt.name as string) ||
          (b.courtName as string) ||
          'Sân thi đấu',
        venue: {
          id: (rawVenue.id as string) || (b.venueId as string) || '',
          name: (rawVenue.name as string) || (b.venueName as string) || 'Cơ sở',
          slug: (rawVenue.slug as string) || '',
          address: (rawVenue.address as string) || '',
        },
      },
    } as unknown as BookingDetail;
  });
  return { data, meta: res.meta };
}

export async function getBooking(id: string) {
  const b = await apiFetch<Record<string, unknown>>(
    `/bookings/${encodeURIComponent(id)}`,
  );
  const rawCourt = (b.court as Record<string, unknown>) || {};
  const rawVenue = (rawCourt.venue as Record<string, unknown>) || {};
  const rawDuring = (b.during as { start?: string; end?: string }) || {};
  const start = (b.start as string) || rawDuring.start || '';
  const end = (b.end as string) || rawDuring.end || '';
  return {
    ...b,
    during: { start, end },
    court: {
      id: (rawCourt.id as string) || (b.courtId as string) || '',
      name:
        (rawCourt.name as string) || (b.courtName as string) || 'Sân thi đấu',
      venue: {
        id: (rawVenue.id as string) || (b.venueId as string) || '',
        name: (rawVenue.name as string) || (b.venueName as string) || 'Cơ sở',
        slug: (rawVenue.slug as string) || '',
        address: (rawVenue.address as string) || '',
      },
    },
  } as unknown as BookingDetail;
}

export function cancelBooking(id: string, reason?: string) {
  return apiFetch<BookingDetail>(`/bookings/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    ...jsonBody({ reason }),
  });
}

/**
 * `POST /bookings/:id/payment/proof` — tải ảnh biên lai.
 *
 * Dùng `FormData` nên KHÔNG set `Content-Type`: trình duyệt phải tự thêm
 * boundary, ghi đè thủ công sẽ làm server không parse được.
 */
export function uploadPaymentProof(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<Payment>(`/bookings/${encodeURIComponent(id)}/payment/proof`, {
    method: 'POST',
    body: form,
  });
}

// ===== Đánh giá =====

/** `POST /reviews` — đánh giá gắn với lượt đặt đã hoàn tất (CUS-12). */
export function createReview(bookingId: string, input: Omit<CreateReviewInput, 'bookingId'>) {
  return apiFetch<Review>('/reviews', {
    method: 'POST',
    ...jsonBody({ bookingId, ...input }),
  });
}

/** `GET /venues/:id/reviews` */
export function listVenueReviews(venueId: string, params: { page?: number; limit?: number } = {}) {
  return apiFetchWithMeta<Review[]>(`/venues/${encodeURIComponent(venueId)}/reviews`, {
    query: { ...params },
  });
}

// ===== Yêu thích =====

export function listFavorites() {
  return apiFetch<VenueListItem[]>('/favorites');
}

export function addFavorite(venueId: string) {
  return apiFetch<{ favorited: true }>(`/favorites/${encodeURIComponent(venueId)}`, {
    method: 'PUT',
  });
}

export function removeFavorite(venueId: string) {
  return apiFetch<{ favorited: false }>(`/favorites/${encodeURIComponent(venueId)}`, {
    method: 'DELETE',
  });
}
