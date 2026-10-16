import type { Booking, Payment, Review } from '@bsc/shared';
import { HOLD_MINUTES } from '@bsc/shared';
import { toDateOnly, toIso } from './slots';
import { courtIdForVenue, venues } from './venues';

/**
 * Booking & thanh toán mẫu, phủ đủ 7 trạng thái của `BookingStatus` và 7 trạng
 * thái của `PaymentStatus` — để mọi màn hình (lịch sử khách, duyệt thanh toán
 * của chủ sân, giám sát của admin) đều có dữ liệu thật để hiển thị.
 *
 * Ngày được tính tương đối so với "hôm nay" lúc chạy, nên dữ liệu không bị cũ
 * sau vài tuần như khi ghim cứng ngày.
 */

const CUSTOMER_1 = '019273c5-7f12-7000-8000-000000000002';
const CUSTOMER_2 = '019273c5-7f12-7000-8000-000000000003';
const CUSTOMER_3 = '019273c5-7f12-7000-8000-000000000004';

const V1 = '019273c5-7f12-7001-a1b2-c3d4e5f60001'; // Cầu lông Thăng Long
const V2 = '019273c5-7f12-7001-a1b2-c3d4e5f60002'; // Bóng đá Phú Thọ
const V3 = '019273c5-7f12-7001-a1b2-c3d4e5f60003'; // Pickleball Sala

/** id sân con – khớp cách sinh id trong fixtures/venues.ts. */
const courtId = courtIdForVenue;

const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
};

const today = dayOffset(0);
const tomorrow = dayOffset(1);
const yesterday = dayOffset(-1);

/** Giờ tương đối so với hiện tại, để booking "hôm nay" luôn nằm ở tương lai gần. */
function todayAtNextHour(plusHours: number, slotIndex = 0): string {
  const d = new Date();
  d.setHours(d.getHours() + plusHours, slotIndex * 30, 0, 0);
  return toIso(toDateOnly(d), d.getHours() * 60 + d.getMinutes());
}

let seq = 0;
const bid = () => `019273c5-7f13-7000-9000-${String(++seq).padStart(12, '0')}`;
const pid = () => `019273c5-7f14-7000-9000-${String(seq).padStart(12, '0')}`;
const rid = () => `019273c5-7f15-7000-9000-${String(seq).padStart(12, '0')}`;

export interface BookingRecord {
  booking: Booking;
  payment: Payment | null;
  review: Review | null;
}

/** Giữ chỗ đang hoạt động — dùng cho Kịch bản A và để SlotGrid có ô `my_hold`. */
function heldNow(): BookingRecord {
  const id = bid();
  const start = todayAtNextHour(2);
  const endIso = new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString();
  const end = `${toDateOnly(new Date(endIso))}T${new Date(endIso).getHours().toString().padStart(2, '0')}:${new Date(endIso).getMinutes().toString().padStart(2, '0')}:00+07:00`;
  const expires = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();

  return {
    booking: {
      id,
      courtId: courtId(V1, 1),
      customerId: CUSTOMER_1,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start, end },
      status: 'held',
      totalPrice: 80000,
      depositAmount: 80000,
      note: null,
      expiresAt: expires,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date().toISOString(),
    },
    payment: {
      id: pid(),
      amount: 80000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: null,
      proofUploadedAt: null,
      status: 'pending',
      paidAt: null,
      reviewedBy: null,
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/** Booking đang chờ chủ sân duyệt thanh toán — có ảnh biên lai để xem. */
function pendingReview(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V1, 2),
      customerId: CUSTOMER_2,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: toIso(tomorrow, 19 * 60), end: toIso(tomorrow, 20 * 60) },
      status: 'pending_payment',
      totalPrice: 224000,
      depositAmount: 224000,
      note: 'Đội mình đông người, xin giữ 2 tiếng nhé.',
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 224000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: 'https://picsum.photos/seed/receipt-1/800/1000',
      proofUploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'submitted',
      paidAt: null,
      reviewedBy: null,
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/** Đã xác nhận, sắp diễn ra. */
function confirmed(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V3, 1),
      customerId: CUSTOMER_1,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: toIso(tomorrow, 8 * 60), end: toIso(tomorrow, 9 * 60 + 30) },
      status: 'confirmed',
      totalPrice: 450000,
      depositAmount: 450000,
      note: null,
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 450000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: 'https://picsum.photos/seed/receipt-2/800/1000',
      proofUploadedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      paidAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      reviewedBy: '019273c5-7f12-7000-8000-000000000001',
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/** Đã chơi xong và đã đánh giá — có phản hồi của chủ sân. */
function completedWithReview(): BookingRecord {
  const id = bid();
  const reviewId = rid();
  return {
    booking: {
      id,
      courtId: courtId(V2, 1),
      customerId: CUSTOMER_2,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: toIso(yesterday, 8 * 60), end: toIso(yesterday, 9 * 60 + 30) },
      status: 'completed',
      totalPrice: 450000,
      depositAmount: 225000,
      note: null,
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 225000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: 'https://picsum.photos/seed/receipt-3/800/1000',
      proofUploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      reviewedBy: '019273c5-7f12-7000-8000-000000000001',
      rejectReason: null,
      refundAmount: null,
    },
    review: {
      id: reviewId,
      bookingId: id,
      venueId: V2,
      customerId: CUSTOMER_2,
      rating: 5,
      comment:
        'Sân đẹp, cỏ mới, nhân viên nhiệt tình. Đèn sáng đủ chơi tối. Sẽ quay lại cùng đội.',
      ownerReply: 'Cảm ơn bạn đã tin tưởng! Hẹn gặp lại đội bạn tuần sau nhé.',
      ownerRepliedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

function completedWithUnrepliedReview(): BookingRecord {
  const record = completedWithReview();
  const bookingId = bid();
  const reviewId = rid();
  const reviewedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  return {
    ...record,
    booking: {
      ...record.booking,
      id: bookingId,
      customerId: CUSTOMER_1,
      during: { start: toIso(dayOffset(-2), 19 * 60), end: toIso(dayOffset(-2), 20 * 60) },
      createdAt: reviewedAt,
    },
    review: record.review
      ? {
          ...record.review,
          id: reviewId,
          bookingId,
          customerId: CUSTOMER_1,
          rating: 4,
          comment: 'Sân đẹp, cỏ mới, nhân viên nhiệt tình. Đèn sáng đủ chơi tối. Sẽ quay lại cùng đội.',
          ownerReply: null,
          ownerRepliedAt: null,
          createdAt: reviewedAt,
        }
      : null,
  };
}

/** Đã hoàn tất nhưng chưa đánh giá — để màn "Viết đánh giá" có việc làm. */
function completedNoReview(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V3, 2),
      customerId: CUSTOMER_1,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: toIso(dayOffset(-2), 20 * 60), end: toIso(dayOffset(-2), 21 * 60) },
      status: 'completed',
      totalPrice: 300000,
      depositAmount: 300000,
      note: null,
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 300000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: 'https://picsum.photos/seed/receipt-4/800/1000',
      proofUploadedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      paidAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      reviewedBy: '019273c5-7f12-7000-8000-000000000006',
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/** Bị từ chối biên lai — có lý do để hiển thị. */
function paymentRejected(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V1, 3),
      customerId: CUSTOMER_3,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: toIso(tomorrow, 21 * 60), end: toIso(tomorrow, 22 * 60) },
      status: 'cancelled',
      totalPrice: 112000,
      depositAmount: 112000,
      note: null,
      expiresAt: null,
      cancelledAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      cancelReason: 'Biên lai không hợp lệ',
      createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 112000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: 'https://picsum.photos/seed/receipt-5/800/1000',
      proofUploadedAt: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
      status: 'rejected',
      paidAt: null,
      reviewedBy: '019273c5-7f12-7000-8000-000000000001',
      rejectReason: 'Số tiền chuyển khoản không khớp với số tiền cần cọc. Vui lòng kiểm tra lại.',
      refundAmount: null,
    },
    review: null,
  };
}

/** Khách tự huỷ, đã hoàn cọc một phần. */
function cancelledRefunded(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V2, 2),
      customerId: CUSTOMER_1,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: toIso(dayOffset(-3), 10 * 60), end: toIso(dayOffset(-3), 11 * 60 + 30) },
      status: 'cancelled',
      totalPrice: 450000,
      depositAmount: 225000,
      note: null,
      expiresAt: null,
      cancelledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      cancelReason: 'Đội có người bận đột xuất',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 225000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: 'https://picsum.photos/seed/receipt-6/800/1000',
      proofUploadedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'refunded',
      paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      reviewedBy: '019273c5-7f12-7000-8000-000000000001',
      rejectReason: null,
      refundAmount: 112500,
    },
    review: null,
  };
}

/** Giữ chỗ đã hết hạn, chưa thanh toán — slot đã tự trả về trống. */
function expiredHold(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V1, 4),
      customerId: CUSTOMER_2,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: toIso(yesterday, 9 * 60), end: toIso(yesterday, 10 * 60) },
      status: 'expired',
      totalPrice: 80000,
      depositAmount: 80000,
      note: null,
      expiresAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 80000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: null,
      proofUploadedAt: null,
      status: 'expired',
      paidAt: null,
      reviewedBy: null,
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/** Khách không đến (no-show) — booking tại quầy do chủ sân tạo. */
function noShow(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V1, 1),
      customerId: null,
      source: 'manual',
      guestName: 'Khách vãng lai – anh Dũng',
      guestPhone: '0901234999',
      during: { start: toIso(dayOffset(-4), 20 * 60), end: toIso(dayOffset(-4), 21 * 60) },
      status: 'no_show',
      totalPrice: 160000,
      depositAmount: 0,
      note: 'Khách gọi điện đặt, trả tiền mặt tại quầy.',
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 160000,
      provider: 'cash',
      transferCode: null,
      proofUrl: null,
      proofUploadedAt: null,
      status: 'cancelled',
      paidAt: null,
      reviewedBy: null,
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/** Booking tại quầy sắp tới, chủ sân tự tạo trên timeline. */
function manualUpcoming(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V1, 3),
      customerId: null,
      source: 'manual',
      guestName: 'CLB Cầu lông Sao Mai',
      guestPhone: '0938111222',
      during: { start: toIso(tomorrow, 6 * 60), end: toIso(tomorrow, 8 * 60) },
      status: 'confirmed',
      totalPrice: 320000,
      depositAmount: 0,
      note: 'CLB đặt cố định thứ 3 hằng tuần.',
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 320000,
      provider: 'cash',
      transferCode: null,
      proofUrl: null,
      proofUploadedAt: null,
      status: 'completed',
      paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      reviewedBy: '019273c5-7f12-7000-8000-000000000001',
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/** Đang giữ chỗ nhưng KHÔNG phải của người dùng hiện tại (ô `held` xám/vàng). */
function heldByOther(): BookingRecord {
  const id = bid();
  return {
    booking: {
      id,
      courtId: courtId(V3, 3),
      customerId: CUSTOMER_3,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: todayAtNextHour(3), end: todayAtNextHour(3, 30) },
      status: 'held',
      totalPrice: 150000,
      depositAmount: 150000,
      note: null,
      expiresAt: new Date(Date.now() + 6 * 60 * 1000).toISOString(),
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 150000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: null,
      proofUploadedAt: null,
      status: 'pending',
      paidAt: null,
      reviewedBy: null,
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/** Một booking hôm nay đã xác nhận – để lưới slot hôm nay có ô `booked`. */
function confirmedToday(): BookingRecord {
  const id = bid();
  const start = todayAtNextHour(1);
  const startDate = new Date(start);
  const endMin = startDate.getHours() * 60 + startDate.getMinutes() + 30;
  return {
    booking: {
      id,
      courtId: courtId(V1, 1),
      customerId: CUSTOMER_2,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start, end: toIso(toDateOnly(startDate), endMin) },
      status: 'confirmed',
      totalPrice: 80000,
      depositAmount: 80000,
      note: null,
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    },
    payment: {
      id: pid(),
      amount: 80000,
      provider: 'bank_transfer',
      transferCode: `BSC${id.slice(-6).toUpperCase()}`,
      proofUrl: 'https://picsum.photos/seed/receipt-7/800/1000',
      proofUploadedAt: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      paidAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      reviewedBy: '019273c5-7f12-7000-8000-000000000001',
      rejectReason: null,
      refundAmount: null,
    },
    review: null,
  };
}

/**
 * Trạng thái sống của mock — bị thay đổi khi người dùng thao tác
 * (giữ chỗ, gửi biên lai, duyệt...). `resetMockState()` khôi phục ban đầu.
 */
function buildInitial(): BookingRecord[] {
  return [
    heldNow(),
    pendingReview(),
    confirmed(),
    completedWithReview(),
    completedWithUnrepliedReview(),
    completedNoReview(),
    paymentRejected(),
    cancelledRefunded(),
    expiredHold(),
    noShow(),
    manualUpcoming(),
    heldByOther(),
    confirmedToday(),
  ];
}

export const initialBookings: BookingRecord[] = buildInitial();

/** Bản sao sâu để khôi phục khi cần (test, hoặc nút "reset" khi dev). */
export function cloneBookings(src: BookingRecord[] = initialBookings): BookingRecord[] {
  return JSON.parse(JSON.stringify(src)) as BookingRecord[];
}

export const venueNameById: Record<string, string> = Object.fromEntries(
  venues.map((v) => [v.id, v.name]),
);

export const venueSlugById: Record<string, string> = Object.fromEntries(
  venues.map((v) => [v.id, v.slug]),
);

export const venueAddressById: Record<string, string> = Object.fromEntries(
  venues.map((v) => [v.id, v.address]),
);

export const venueIdByCourtId: Record<string, string> = Object.fromEntries(
  venues.flatMap((v) => v.courts.map((c) => [c.id, v.id])),
);

export const courtNameByCourtId: Record<string, string> = Object.fromEntries(
  venues.flatMap((v) => v.courts.map((c) => [c.id, c.name])),
);

export { courtId };
