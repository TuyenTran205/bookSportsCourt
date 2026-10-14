import { http } from 'msw';
import type { Booking, BookingDetail, Payment, Review, Slot } from '@bsc/shared';
import { HOLD_MINUTES } from '@bsc/shared';
import { db, currentUser, persist } from '../db';
import {
  courtNameByCourtId,
  venueAddressById,
  venueIdByCourtId,
  venueNameById,
  venueSlugById,
} from '../fixtures/bookings';
import { buildSlots, computeDeposit, mergeAdjacentSlots, toDateOnly } from '../fixtures/slots';
import { pricingRules, venues } from '../fixtures/venues';
import { err, newId, ok, okList, paginate, readPaging, simulateLatency, transferCode } from '../utils';
import { publish, publishSlotUpdate } from '../realtime';

/**
 * Phát sự kiện realtime cho đúng những ô vừa đổi.
 *
 * Sau khi state đổi, tính lại lưới slot của ngày liên quan rồi chỉ gửi những ô
 * khác với trước — đúng tinh thần payload `slot_updated` trong docs/05: chỉ gửi
 * ô thay đổi, không gửi cả lưới.
 */
function broadcastSlots(courtId: string, date: string): void {
  const venueId = venueIdByCourtId[courtId] ?? '';
  const grid = buildSlots({
    date,
    courtId,
    venueId,
    openingHours: db.openingHours,
    pricingRules,
    blackouts: db.blackouts,
    bookings: db.bookings.map((b) => b.booking),
    currentUserId: db.currentUserId,
  });

  publishSlotUpdate(
    venueId,
    courtId,
    date,
    grid.map((s) => ({ start: s.start, end: s.end, status: s.status, price: s.price, mine: s.mine })),
  );
}

/** Tài khoản nhận tiền của chủ sân – dùng để FE tự dựng mã QR thanh toán từ số tiền và số tài khoản ngân hàng ở màn Checkout. */
const OWNER_BANK = {
  bankBin: '970436',
  accountNo: '1234567890',
  accountName: 'NGUYEN VAN OWNER',
};

/** Lắp shape lồng nhau cho `BookingDetail` – docs/11-api-contract.md mục 8.4. */
function toDetail(record: (typeof db.bookings)[number]): BookingDetail {
  const { booking, payment, review } = record;
  const venueId = venueIdByCourtId[booking.courtId] ?? '';
  const venue = venues.find((v) => v.id === venueId);

  return {
    ...booking,
    court: {
      id: booking.courtId,
      name: courtNameByCourtId[booking.courtId] ?? 'Sân',
      venue: {
        id: venueId,
        name: venueNameById[venueId] ?? venue?.name ?? 'Cơ sở',
        slug: venueSlugById[venueId] ?? venue?.slug ?? '',
        address: venueAddressById[venueId] ?? venue?.address ?? '',
      },
    },
    customer: booking.customerId
      ? (() => {
          const u = db.users.find((x) => x.id === booking.customerId);
          if (!u) return null;
          const phone = u.phone;
          return {
            id: u.id,
            fullName: u.fullName,
            // Che số điện thoại khi trả cho chủ sân – docs/06.
            phone: phone ? `${phone.slice(0, 4)}***${phone.slice(-3)}` : null,
            email: u.email,
          };
        })()
      : booking.guestName
        ? {
            id: '',
            fullName: booking.guestName,
            phone: booking.guestPhone,
            email: '',
          }
        : null,
    payment,
    review,
  };
}

/** Tính tiền cho các slot đã chọn từ bảng giá thật của cơ sở. */
function priceSlots(courtId: string, date: string, wanted: Array<{ start: string; end: string }>) {
  const venueId = venueIdByCourtId[courtId] ?? '';
  const grid = buildSlots({
    date,
    courtId,
    venueId,
    openingHours: db.openingHours,
    pricingRules,
    blackouts: db.blackouts,
    bookings: db.bookings.map((b) => b.booking),
    currentUserId: db.currentUserId,
  });

  const picked: Slot[] = [];
  for (const w of wanted) {
    const wStart = new Date(w.start).getTime();
    const wEnd = new Date(w.end).getTime();
    // Một khoảng có thể gồm nhiều block 30 phút — tách ra để tính đúng giá.
    // So sánh theo timestamp số để tránh lỗi lệch format chuỗi múi giờ (+07:00 vs Z).
    const parts = grid.filter((s) => {
      const sStart = new Date(s.start).getTime();
      const sEnd = new Date(s.end).getTime();
      return sStart >= wStart && sEnd <= wEnd;
    });
    if (parts.length === 0) return { error: 'SLOT_NOT_FOUND' as const, picked };
    picked.push(...parts);
  }

  return {
    picked,
    total: picked.reduce((sum, s) => sum + s.price, 0),
    blocked: picked.filter((s) => s.status !== 'available'),
  };
}

export const bookingHandlers = [
  /**
   * Giữ chỗ.
   *
   * Đây là endpoint quan trọng nhất của mock: nó kiểm tra tranh chấp thật trên
   * state chia sẻ giữa các tab, nên Kịch bản B (hai tab giành cùng một slot)
   * hoạt động đúng — tab thứ hai nhận 409.
   */
  http.post('/api/v1/bookings/hold', async ({ request }) => {
    await simulateLatency(450);
    const user = currentUser();
    if (!user) {
      return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để đặt sân');
    }

    const body = (await request.json()) as {
      courtId: string;
      slots: Array<{ start: string; end: string }>;
      idempotencyKey: string;
      note?: string;
    };

    if (!body.slots || body.slots.length === 0) {
      return err(422, 'VALIDATION_ERROR', 'Vui lòng chọn ít nhất một khung giờ');
    }
    if (body.slots.length > 16) {
      return err(422, 'VALIDATION_ERROR', 'Tối đa 16 khung giờ (8 tiếng) cho mỗi lượt đặt sân');
    }

    // Giới hạn hold đồng thời: mỗi khách tối đa 3 booking ở trạng thái `held` (docs/11).
    const activeHolds = db.bookings.filter(
      (b) =>
        b.booking.customerId === user.id &&
        b.booking.status === 'held' &&
        b.booking.expiresAt &&
        new Date(b.booking.expiresAt).getTime() > Date.now(),
    );
    if (activeHolds.length >= 3) {
      return err(
        422,
        'HOLD_LIMIT_EXCEEDED',
        'Bạn đang có 3 lượt giữ chỗ chưa thanh toán. Vui lòng hoàn tất thanh toán hoặc huỷ lượt trước đó để tiếp tục.',
      );
    }

    // Idempotency: cùng key gửi lại → trả lại hold cũ thay vì tạo mới
    // (docs/11-api-contract.md mục Idempotency).
    const existing = db.bookings.find(
      (b) => b.booking.note === `__idem:${body.idempotencyKey}` && b.booking.status === 'held',
    );
    if (existing) {
      return ok({
        booking: existing.booking,
        payment: {
          id: existing.payment?.id ?? newId(),
          amount: existing.payment?.amount ?? existing.booking.depositAmount,
          transferCode: transferCode(existing.booking.id),
          bankAccount: OWNER_BANK,
        },
      });
    }

    const firstSlot = body.slots[0];
    if (!firstSlot) return err(422, 'VALIDATION_ERROR', 'Thiếu thông tin khung giờ');
    const date = toDateOnly(new Date(firstSlot.start));

    const priced = priceSlots(body.courtId, date, body.slots);
    if ('error' in priced) {
      return err(404, 'NOT_FOUND', 'Khung giờ không nằm trong giờ mở cửa của sân');
    }

    // Tranh chấp: có block không còn trống → 409, đúng docs/05.
    if (priced.blocked && priced.blocked.length > 0) {
      return err(
        409,
        'SLOT_TAKEN',
        'Khung giờ này vừa được người khác đặt. Vui lòng chọn giờ khác.',
      );
    }

    const venueId = venueIdByCourtId[body.courtId] ?? '';
    const venue = venues.find((v) => v.id === venueId);
    const depositPercent = venue?.cancellationPolicy?.depositPercent ?? 100;
    const total = priced.total ?? 0;

    const id = newId();
    const booking: Booking = {
      id,
      courtId: body.courtId,
      customerId: user?.id ?? null,
      source: 'online',
      guestName: null,
      guestPhone: null,
      during: { start: body.slots[0]!.start, end: body.slots[body.slots.length - 1]!.end },
      status: 'held',
      totalPrice: total,
      depositAmount: computeDeposit(total, depositPercent),
      note: `__idem:${body.idempotencyKey}`,
      expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString(),
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date().toISOString(),
    };

    const payment: Payment = {
      id: newId(),
      amount: booking.depositAmount,
      provider: 'bank_transfer',
      transferCode: transferCode(id),
      proofUrl: null,
      proofUploadedAt: null,
      status: 'pending',
      paidAt: null,
      reviewedBy: null,
      rejectReason: null,
      refundAmount: null,
    };

    db.bookings.unshift({ booking, payment, review: null });
    persist();

    // Cho mọi tab thấy khung giờ vừa bị giữ — nền tảng của Kịch bản B.
    broadcastSlots(body.courtId, date);

    return ok(
      {
        booking,
        payment: {
          id: payment.id,
          amount: payment.amount,
          transferCode: payment.transferCode!,
          bankAccount: OWNER_BANK,
        },
      },
      201,
    );
  }),

  /** Trạng thái hold – dùng để đếm ngược và phát hiện hết hạn. */
  http.get('/api/v1/bookings/hold/:id', async ({ params }) => {
    await simulateLatency(150);
    const record = db.bookings.find((b) => b.booking.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy lượt giữ chỗ');

    // Tự chuyển sang `expired` khi quá hạn, và trả slot về trống — đúng
    // docs/05 ("hết hạn thì tự động trả slot").
    if (record.booking.status === 'held' && record.booking.expiresAt) {
      if (new Date(record.booking.expiresAt).getTime() < Date.now()) {
        record.booking.status = 'expired';
        if (record.payment) record.payment.status = 'expired';
        persist();
      }
    }

    const remainingMs = record.booking.expiresAt
      ? Math.max(0, new Date(record.booking.expiresAt).getTime() - Date.now())
      : 0;

    // Cùng hình dạng với POST /bookings/hold để trang thanh toán tải lại vẫn dựng lại được mã QR.
    return ok({
      booking: record.booking,
      remainingMs,
      payment: {
        id: record.payment?.id ?? newId(),
        amount: record.payment?.amount ?? record.booking.depositAmount,
        transferCode: record.payment?.transferCode ?? transferCode(record.booking.id),
        bankAccount: OWNER_BANK,
      },
    });
  }),

  /**
   * Gửi ảnh biên lai (multipart/form-data).
   *
   * Mock không lưu file thật: sinh một URL picsum để màn duyệt của chủ sân có
   * ảnh mà xem, đúng luồng "xem phóng to biên lai".
   */
  http.post('/api/v1/bookings/:id/payment/proof', async ({ params, request }) => {
    await simulateLatency(800);
    const record = db.bookings.find((b) => b.booking.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt sân');

    if (record.booking.status === 'expired') {
      return err(410, 'HOLD_EXPIRED', 'Thời gian giữ chỗ đã hết. Vui lòng chọn lại khung giờ.');
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return err(422, 'VALIDATION_ERROR', 'Thiếu ảnh biên lai', { file: ['Vui lòng chọn ảnh'] });
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return err(415, 'UNSUPPORTED_FILE_TYPE', 'Chỉ nhận ảnh JPG, PNG hoặc WebP');
    }
    if (file.size > 5 * 1024 * 1024) {
      return err(413, 'FILE_TOO_LARGE', 'Ảnh vượt quá 5MB');
    }

    const proofUrl = `https://picsum.photos/seed/proof-${params.id}/800/1000`;

    record.booking.status = 'pending_payment';
    record.booking.expiresAt = null; // đã gửi tiền thì không còn đếm ngược
    if (record.payment) {
      record.payment.proofUrl = proofUrl;
      record.payment.proofUploadedAt = new Date().toISOString();
      record.payment.status = 'submitted';
    }
    persist();

    // Bắn realtime cho chủ sân biết có biên lai mới và cập nhật slot
    publish({ type: 'payment_submitted', payload: { bookingId: record.booking.id } });
    broadcastSlots(record.booking.courtId, record.booking.during.start.slice(0, 10));

    return ok({ booking: record.booking, payment: record.payment });
  }),

  /** Lịch sử đặt sân của khách đang đăng nhập. */
  http.get('/api/v1/bookings', async ({ request }) => {
    await simulateLatency(350);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để xem lịch sử đặt sân');

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const status = url.searchParams.get('status');

    let list = db.bookings.filter((b) => b.booking.customerId === user.id);
    if (status) list = list.filter((b) => b.booking.status === status);

    list = [...list].sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt));

    const { data, meta } = paginate(list.map(toDetail), page, limit);
    return okList(data, meta);
  }),

  http.get('/api/v1/bookings/:id', async ({ params }) => {
    await simulateLatency(250);
    const record = db.bookings.find((b) => b.booking.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt sân');
    return ok(toDetail(record));
  }),

  /** Khách tự huỷ — hoàn tiền theo chính sách của cơ sở. */
  http.post('/api/v1/bookings/:id/cancel', async ({ params, request }) => {
    await simulateLatency(400);
    const record = db.bookings.find((b) => b.booking.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt sân');

    if (['completed', 'cancelled', 'expired', 'no_show'].includes(record.booking.status)) {
      return err(409, 'ALREADY_EXISTS', 'Đơn này không thể huỷ ở trạng thái hiện tại');
    }

    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const venueId = venueIdByCourtId[record.booking.courtId] ?? '';
    const venue = venues.find((v) => v.id === venueId);
    const policy = venue?.cancellationPolicy;

    // Hoàn theo chính sách: huỷ đủ sớm thì hoàn theo %, muộn quá thì mất cọc.
    let refundAmount = 0;
    if (policy && record.payment?.status === 'completed') {
      const hoursUntil = (new Date(record.booking.during.start).getTime() - Date.now()) / 3_600_000;
      refundAmount =
        hoursUntil >= policy.cancelBeforeHours
          ? Math.round((record.payment.amount * policy.refundPercent) / 100)
          : 0;
    }

    record.booking.status = 'cancelled';
    record.booking.cancelledAt = new Date().toISOString();
    record.booking.cancelReason = body.reason ?? 'Khách tự huỷ';
    record.booking.expiresAt = null;
    if (record.payment && refundAmount > 0) {
      record.payment.status = 'refunded';
      record.payment.refundAmount = refundAmount;
    }
    persist();

    // Slot được trả về trống — các tab khác phải thấy ngay.
    broadcastSlots(record.booking.courtId, record.booking.during.start.slice(0, 10));
    publish({ type: 'booking_cancelled', payload: { bookingId: record.booking.id } });

    return ok({ booking: record.booking, refundAmount });
  }),

  /** Đánh giá sau khi đã chơi xong. */
  http.post('/api/v1/bookings/:id/review', async ({ params, request }) => {
    await simulateLatency(400);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để đánh giá');

    const record = db.bookings.find((b) => b.booking.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt sân');
    if (record.booking.status !== 'completed') {
      return err(409, 'ALREADY_EXISTS', 'Chỉ có thể đánh giá sau khi đã hoàn tất lượt chơi');
    }
    if (record.review) {
      return err(409, 'ALREADY_EXISTS', 'Bạn đã đánh giá lượt chơi này rồi');
    }

    const body = (await request.json()) as { rating: number; comment?: string };
    const venueId = venueIdByCourtId[record.booking.courtId] ?? '';

    const review: Review = {
      id: newId(),
      bookingId: record.booking.id,
      venueId,
      customerId: user.id,
      rating: body.rating,
      comment: body.comment ?? null,
      ownerReply: null,
      ownerRepliedAt: null,
      createdAt: new Date().toISOString(),
    };

    record.review = review;
    db.reviews.unshift(review);
    persist();

    return ok(review, 201);
  }),

  /** Tóm tắt tiền cho thanh dính đáy ở màn đặt sân. */
  http.post('/api/v1/bookings/quote', async ({ request }) => {
    await simulateLatency(200);
    const body = (await request.json()) as {
      courtId: string;
      slots: Array<{ start: string; end: string }>;
    };
    const date = body.slots[0]?.start.slice(0, 10);
    if (!date) return err(422, 'VALIDATION_ERROR', 'Thiếu thông tin khung giờ');

    const priced = priceSlots(body.courtId, date, body.slots);
    if ('error' in priced) return err(404, 'NOT_FOUND', 'Khung giờ không hợp lệ');

    const venueId = venueIdByCourtId[body.courtId] ?? '';
    const venue = venues.find((v) => v.id === venueId);
    const depositPercent = venue?.cancellationPolicy?.depositPercent ?? 100;

    return ok({
      total: priced.total ?? 0,
      deposit: computeDeposit(priced.total ?? 0, depositPercent),
      depositPercent,
      ranges: mergeAdjacentSlots(priced.picked ?? []),
      unavailable: (priced.blocked ?? []).map((s) => s.start),
    });
  }),

  // ── Yêu thích ────────────────────────────────────────────────────────────
  http.get('/api/v1/favorites', async () => {
    await simulateLatency(250);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    // Mock: khách yêu thích sẵn 2 cơ sở để màn hình có dữ liệu.
    const favorites = venues.slice(0, 2).map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      address: v.address,
      coverUrl: v.coverUrl,
      ratingAvg: v.ratingAvg,
      reviewCount: v.reviewCount,
      fromPrice: v.fromPrice,
      province: v.province,
      district: v.district,
      sports: v.sports,
      status: v.status,
      lat: v.lat,
      lng: v.lng,
    }));
    return ok(favorites);
  }),

  http.post('/api/v1/favorites/:venueId', async ({ params }) => {
    await simulateLatency(200);
    return ok({ venueId: params.venueId, favorited: true });
  }),

  http.delete('/api/v1/favorites/:venueId', async ({ params }) => {
    await simulateLatency(200);
    return ok({ venueId: params.venueId, favorited: false });
  }),
];
