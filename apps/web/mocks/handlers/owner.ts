import { http } from 'msw';
import type { Booking, OpeningHour, OwnerApplication, OwnerTimelineBooking, Payment, RevenuePoint } from '@bsc/shared';
import { db, currentUser, persist } from '../db';
import { courtNameByCourtId, venueIdByCourtId } from '../fixtures/bookings';
import { buildSlots, toDateOnly } from '../fixtures/slots';
import { pricingRules, venues } from '../fixtures/venues';
import { publish } from '../realtime';
import {
  err,
  newId,
  ok,
  okList,
  paginate,
  readPaging,
  simulateLatency,
} from '../utils';

/**
 * Handler cho kênh chủ sân.
 *
 * Mọi endpoint đều kiểm tra vai trò: chỉ `owner` (và `admin`) đi qua. Nhờ vậy
 * dựng UI xong có thể thử luôn việc chặn quyền — đăng nhập khách rồi mở
 * `/dashboard` sẽ nhận 403 chứ không phải dữ liệu.
 */
function requireOwner() {
  const user = currentUser();
  if (!user) return { error: err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập') };
  if (user.role !== 'owner' && user.role !== 'admin') {
    return { error: err(403, 'FORBIDDEN', 'Khu vực này chỉ dành cho chủ sân') };
  }
  return { user };
}

/** Các cơ sở thuộc chủ sân đang đăng nhập. */
function ownedVenues() {
  const user = currentUser();
  if (!user) return [];
  if (user.role === 'admin') return venues;
  return venues.filter((v) => v.ownerId === user.id);
}

export const ownerHandlers = [
  // ── Cơ sở & sân con ──────────────────────────────────────────────────────
  http.get('/api/v1/owner/venues', async () => {
    await simulateLatency(300);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(ownedVenues());
  }),

  http.post('/api/v1/owner/venues', async ({ request }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const body = (await request.json()) as Record<string, unknown>;
    // Cơ sở mới vào trạng thái chờ duyệt — đúng luồng Admin duyệt cơ sở.
    return ok({ ...body, id: newId(), status: 'pending' }, 201);
  }),

  http.patch('/api/v1/owner/venues/:id', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const body = (await request.json()) as Record<string, unknown>;
    const venue = venues.find((v) => v.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');
    return ok({ ...venue, ...body });
  }),

  http.post('/api/v1/owner/venues/:id/courts', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ ...body, id: newId(), venueId: params.id }, 201);
  }),

  http.delete('/api/v1/owner/courts/:id', async ({ params }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    // Không cho xoá sân còn booking đang hoạt động — docs/11 (409 RESOURCE_IN_USE).
    const busy = db.bookings.some(
      (b) =>
        b.booking.courtId === params.id &&
        ['held', 'pending_payment', 'confirmed'].includes(b.booking.status),
    );
    if (busy) {
      return err(409, 'RESOURCE_IN_USE', 'Sân còn đơn đang hoạt động, không thể xoá');
    }
    return ok({ success: true });
  }),

  // ── Giờ mở cửa, bảng giá, khoá sân ───────────────────────────────────────
  http.get('/api/v1/owner/venues/:id/opening-hours', async ({ params }) => {
    await simulateLatency(250);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(db.openingHours.filter((o) => o.venueId === params.id));
  }),

  http.put('/api/v1/owner/venues/:id/opening-hours', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venueId = params.id as string;
    const body = (await request.json()) as { hours?: Array<Omit<OpeningHour, 'id' | 'venueId'> & { id?: string; venueId?: string }> } | Array<Omit<OpeningHour, 'id' | 'venueId'> & { id?: string; venueId?: string }>;
    const incoming = Array.isArray(body) ? body : (body.hours ?? []);

    // Loại bỏ giờ mở cửa cũ của cơ sở này trong db
    db.openingHours = db.openingHours.filter((o) => o.venueId !== venueId);

    const updated: OpeningHour[] = incoming.map((h, i) => ({
      id: h.id ?? `${venueId.slice(0, 22)}oh${h.weekday ?? i}`,
      courtId: h.courtId ?? null,
      venueId,
      weekday: h.weekday,
      openTime: h.openTime,
      closeTime: h.closeTime,
      isClosed: Boolean(h.isClosed),
    }));

    db.openingHours.push(...updated);
    persist();
    return ok(updated);
  }),

  http.get('/api/v1/owner/venues/:id/pricing-rules', async ({ params }) => {
    await simulateLatency(250);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(pricingRules.filter((r) => r.venueId === params.id));
  }),

  http.post('/api/v1/owner/venues/:id/pricing-rules', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ ...body, id: newId(), venueId: params.id }, 201);
  }),

  http.delete('/api/v1/owner/pricing-rules/:id', async () => {
    await simulateLatency(300);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok({ success: true });
  }),

  http.post('/api/v1/courts/:id/blackouts', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const body = (await request.json()) as { start: string; end: string; reason?: string };
    const created = {
      id: newId(),
      courtId: params.id as string,
      start: body.start,
      end: body.end,
      reason: body.reason ?? null,
      createdAt: new Date().toISOString(),
    };
    // Ghi vào state sống để lưới slot lập tức hiện ô `blocked`.
    db.blackouts.push(created);
    persist();
    return ok(created, 201);
  }),

  http.get('/api/v1/courts/:id/blackouts', async ({ params }) => {
    await simulateLatency(250);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(db.blackouts.filter((b) => b.courtId === params.id));
  }),

  http.delete('/api/v1/courts/:id/blackouts/:blackoutId', async ({ params }) => {
    await simulateLatency(300);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const courtId = params.id as string;
    const blackoutId = params.blackoutId as string;
    const index = db.blackouts.findIndex(
      (b) => b.id === blackoutId && (b.courtId === courtId || !courtId),
    );
    if (index === -1) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy khoảng khoá sân');
    }
    const removed = db.blackouts.splice(index, 1)[0];
    persist();
    return ok({ success: true, blackout: removed });
  }),

  // ── Tài khoản ngân hàng & chính sách huỷ ─────────────────────────────────
  http.get('/api/v1/owner/bank-account', async () => {
    await simulateLatency(250);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok({
      id: '019273c5-7f17-7000-9000-000000000001',
      bankBin: '970436',
      bankName: 'Vietcombank – Chi nhánh TP. Hồ Chí Minh',
      accountNo: '0071000123456',
      accountName: 'NGUYEN VAN OWNER',
    });
  }),

  http.put('/api/v1/owner/bank-account', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(await request.json());
  }),

  http.put('/api/v1/owner/cancellation-policy', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(await request.json());
  }),

  // ── Duyệt thanh toán ─────────────────────────────────────────────────────
  /**
   * Danh sách đơn cần duyệt. Đây là dữ liệu nuôi màn O-02 và cũng là thứ đổi
   * trạng thái khi bấm Duyệt/Từ chối.
   */
  http.get('/api/v1/owner/payments', async ({ request }) => {
    await simulateLatency(350);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const status = url.searchParams.get('status');

    const myVenueIds = new Set(ownedVenues().map((v) => v.id));

    let list = db.bookings
      .filter((b) => myVenueIds.has(venueIdByCourtId[b.booking.courtId] ?? ''))
      .filter((b) => b.payment !== null);

    if (status) list = list.filter((b) => b.payment!.status === status);

    list = [...list].sort((a, b) =>
      (b.payment?.proofUploadedAt ?? b.booking.createdAt).localeCompare(
        a.payment?.proofUploadedAt ?? a.booking.createdAt,
      ),
    );

    const shaped = list.map((r) => ({
      id: r.payment!.id,
      bookingId: r.booking.id,
      amount: r.payment!.amount,
      provider: r.payment!.provider,
      transferCode: r.payment!.transferCode,
      proofUrl: r.payment!.proofUrl,
      proofUploadedAt: r.payment!.proofUploadedAt,
      status: r.payment!.status,
      rejectReason: r.payment!.rejectReason ?? null,
      booking: {
        id: r.booking.id,
        during: r.booking.during,
        status: r.booking.status,
        totalPrice: r.booking.totalPrice,
        courtName: courtNameByCourtId[r.booking.courtId] ?? 'Sân',
        venueName: venues.find((v) => v.id === (venueIdByCourtId[r.booking.courtId] ?? ''))?.name ?? '',
        customerName:
          db.users.find((u) => u.id === r.booking.customerId)?.fullName ??
          r.booking.guestName ??
          'Khách vãng lai',
        customerPhone:
          db.users.find((u) => u.id === r.booking.customerId)?.phone ?? r.booking.guestPhone ?? null,
      },
    }));

    const { data, meta } = paginate(shaped, page, limit);
    return okList(data, meta);
  }),

  /** Duyệt thanh toán → booking `confirmed`. */
  http.patch('/api/v1/owner/payments/:id/approve', async ({ params }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const record = db.bookings.find((b) => b.payment?.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy giao dịch');

    record.payment!.status = 'completed';
    record.payment!.paidAt = new Date().toISOString();
    record.payment!.reviewedBy = guard.user!.id;
    record.booking.status = 'confirmed';
    persist();
    publish({ type: 'booking_confirmed', payload: { bookingId: record.booking.id } });

    return ok({ booking: record.booking, payment: record.payment });
  }),

  /** Từ chối thanh toán → huỷ đơn và trả slot về trống. */
  http.patch('/api/v1/owner/payments/:id/reject', async ({ params, request }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const record = db.bookings.find((b) => b.payment?.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy giao dịch');

    const body = (await request.json()) as { rejectReason?: string };

    record.payment!.status = 'rejected';
    record.payment!.reviewedBy = guard.user!.id;
    record.payment!.rejectReason = body.rejectReason ?? 'Biên lai không hợp lệ';
    record.booking.status = 'cancelled';
    record.booking.cancelledAt = new Date().toISOString();
    record.booking.cancelReason = body.rejectReason ?? 'Biên lai không hợp lệ';
    persist();
    publish({ type: 'booking_cancelled', payload: { bookingId: record.booking.id } });

    return ok({ booking: record.booking, payment: record.payment });
  }),

  // ── Đơn đặt sân & timeline ───────────────────────────────────────────────
  http.get('/api/v1/owner/bookings', async ({ request }) => {
    await simulateLatency(350);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const status = url.searchParams.get('status');
    const myVenueIds = new Set(ownedVenues().map((v) => v.id));

    let list = db.bookings.filter((b) =>
      myVenueIds.has(venueIdByCourtId[b.booking.courtId] ?? ''),
    );
    if (status) list = list.filter((b) => b.booking.status === status);
    list = [...list].sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt));

    const shaped = list.map((r) => ({
      ...r.booking,
      courtName: courtNameByCourtId[r.booking.courtId] ?? 'Sân',
      customerName:
        db.users.find((u) => u.id === r.booking.customerId)?.fullName ??
        r.booking.guestName ??
        'Khách vãng lai',
      customerPhone:
        db.users.find((u) => u.id === r.booking.customerId)?.phone ?? r.booking.guestPhone ?? null,
      paymentStatus: r.payment?.status ?? null,
    }));

    const { data, meta } = paginate(shaped, page, limit);
    return okList(data, meta);
  }),

  /**
   * Timeline theo ngày — dữ liệu cho `OwnerTimeline` (OWN-06).
   *
   * Phạm vi một cơ sở: trả sân, đơn, khoá sân và giờ mở cửa của cơ sở đó
   * trong một response, để lưới chỉ cần một lượt gọi.
   */
  http.get('/api/v1/owner/timeline', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? toDateOnly(new Date());
    const venueId = url.searchParams.get('venueId');

    if (!venueId) return err(400, 'VALIDATION_ERROR', 'Thiếu tham số venueId.');

    const venue = ownedVenues().find((v) => v.id === venueId);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở.');

    const courtIds = new Set(venue.courts.map((c) => c.id));

    const items: OwnerTimelineBooking[] = db.bookings
      .filter((b) => courtIds.has(b.booking.courtId))
      .filter((b) => b.booking.during.start.slice(0, 10) === date)
      .filter((b) => !['cancelled', 'expired'].includes(b.booking.status))
      .map((b) => ({
        id: b.booking.id,
        courtId: b.booking.courtId,
        during: b.booking.during,
        status: b.booking.status,
        source: b.booking.source,
        guestName: b.booking.guestName,
        customerName:
          db.users.find((u) => u.id === b.booking.customerId)?.fullName ?? b.booking.guestName ?? null,
        totalPrice: b.booking.totalPrice,
      }));

    return ok({
      date,
      venueId,
      courts: venue.courts,
      bookings: items,
      blackouts: db.blackouts.filter((b) => {
        if (!courtIds.has(b.courtId)) return false;
        const dayStart = new Date(`${date}T00:00:00+07:00`).getTime();
        const dayEnd = new Date(`${date}T23:59:59+07:00`).getTime();
        const bStart = new Date(b.start).getTime();
        const bEnd = new Date(b.end).getTime();
        return bStart <= dayEnd && bEnd >= dayStart;
      }),
      // Trả cả 7 thứ: `courtWindow()` tự lọc theo thứ của ngày đang xem.
      openingHours: db.openingHours.filter((o) => o.venueId === venueId),
    });
  }),

  /** Đặt sân tại quầy (chủ sân tạo thay khách). */
  http.post('/api/v1/owner/bookings/manual', async ({ request }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const body = (await request.json()) as {
      courtId: string;
      slots: Array<{ start: string; end: string }>;
      guestName: string;
      guestPhone: string;
      note?: string;
    };

    const date = body.slots[0]?.start.slice(0, 10);
    if (!date) return err(422, 'VALIDATION_ERROR', 'Thiếu thông tin khung giờ');

    const venueId = venueIdByCourtId[body.courtId] ?? '';
    const grid = buildSlots({
      date,
      courtId: body.courtId,
      venueId,
      openingHours: db.openingHours,
      pricingRules,
      blackouts: db.blackouts,
      bookings: db.bookings.map((b) => b.booking),
      currentUserId: db.currentUserId,
    });

    const picked = grid.filter((s) =>
      body.slots.some((w) => s.start >= w.start && s.end <= w.end),
    );
    if (picked.some((s) => s.status !== 'available')) {
      return err(409, 'SLOT_TAKEN', 'Khung giờ này đã có người đặt');
    }

    const booking: Booking = {
      id: newId(),
      courtId: body.courtId,
      customerId: null,
      source: 'manual',
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      during: { start: body.slots[0]!.start, end: body.slots[body.slots.length - 1]!.end },
      status: 'confirmed',
      totalPrice: picked.reduce((s, x) => s + x.price, 0),
      depositAmount: 0,
      note: body.note ?? null,
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date().toISOString(),
    };

    const payment: Payment = {
      id: newId(),
      amount: booking.totalPrice,
      provider: 'cash',
      transferCode: null,
      proofUrl: null,
      proofUploadedAt: null,
      status: 'completed',
      paidAt: new Date().toISOString(),
      reviewedBy: guard.user!.id,
      rejectReason: null,
      refundAmount: null,
    };

    db.bookings.unshift({ booking, payment, review: null });
    persist();
    return ok(booking, 201);
  }),

  // ── Báo cáo doanh thu ────────────────────────────────────────────────────
  http.get('/api/v1/owner/revenue', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const days = Number.parseInt(url.searchParams.get('days') ?? '30', 10);
    const myVenueIds = new Set(ownedVenues().map((v) => v.id));

    const revenueBookings = db.bookings.filter(
      (b) =>
        myVenueIds.has(venueIdByCourtId[b.booking.courtId] ?? '') &&
        ['confirmed', 'completed'].includes(b.booking.status),
    );

    // Chuỗi ngày liên tục, kể cả ngày không có đơn (biểu đồ không bị đứt).
    const series: RevenuePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toDateOnly(d);
      const dayBookings = revenueBookings.filter((b) => b.booking.during.start.slice(0, 10) === key);
      series.push({
        date: key,
        revenue: dayBookings.reduce((s, b) => s + b.booking.totalPrice, 0),
        bookings: dayBookings.length,
      });
    }

    const totalRevenue = series.reduce((s, p) => s + p.revenue, 0);
    const totalBookings = series.reduce((s, p) => s + p.bookings, 0);
    const totalCourts = ownedVenues().reduce((s, v) => s + v.courts.length, 0);

    // Tỷ lệ lấp đầy: số block đã bán / tổng block mở cửa (giả định 34 block/ngày/sân).
    const capacity = days * totalCourts * 34;
    const soldBlocks = revenueBookings.length * 2;

    return ok({
      summary: {
        totalRevenue,
        totalBookings,
        occupancyRate: capacity > 0 ? Math.min(1, soldBlocks / capacity) : 0,
        from: series[0]?.date ?? '',
        to: series[series.length - 1]?.date ?? '',
      },
      series,
      points: series,
    });
  }),

  // ── Đánh giá ─────────────────────────────────────────────────────────────
  http.get('/api/v1/owner/reviews', async ({ request }) => {
    await simulateLatency(300);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const myVenueIds = new Set(ownedVenues().map((v) => v.id));

    const list = db.reviews
      .filter((r) => myVenueIds.has(r.venueId))
      .map((r) => ({
        ...r,
        venueName: venues.find((v) => v.id === r.venueId)?.name ?? '',
        customerName: db.users.find((u) => u.id === r.customerId)?.fullName ?? 'Khách',
      }));

    const { data, meta } = paginate(list, page, limit);
    return okList(data, meta);
  }),

  http.patch('/api/v1/owner/reviews/:id/reply', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const review = db.reviews.find((r) => r.id === params.id);
    if (!review) return err(404, 'NOT_FOUND', 'Không tìm thấy đánh giá');

    const body = (await request.json()) as { ownerReply: string };
    review.ownerReply = body.ownerReply;
    review.ownerRepliedAt = new Date().toISOString();

    // Đồng bộ vào record booking để màn chi tiết cũng thấy phản hồi.
    const record = db.bookings.find((b) => b.review?.id === params.id);
    if (record?.review) {
      record.review.ownerReply = review.ownerReply;
      record.review.ownerRepliedAt = review.ownerRepliedAt;
    }
    persist();

    return ok(review);
  }),

  // ── Đăng ký làm chủ sân (OWN-01 / BSC-062) ───────────────────────────────
  http.post('/api/v1/owner/apply', async ({ request }) => {
    await simulateLatency(600);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const body = (await request.json()) as Record<string, unknown>;

    // Kiểm tra hồ sơ pending hiện có
    const pendingApp = db.ownerApplications.find((a) => a.user.id === user.id && a.status === 'pending');
    if (pendingApp) {
      return err(409, 'ALREADY_PENDING', 'Bạn đã có một hồ sơ đang chờ xét duyệt');
    }

    const newApp: OwnerApplication = {
      id: newId(),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: (body.phone as string) || user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      businessName: String(body.businessName || 'Cơ sở kinh doanh'),
      taxCode: body.taxCode ? String(body.taxCode) : null,
      idCardUrl: body.idCardUrl ? String(body.idCardUrl) : 'https://picsum.photos/seed/cccd-apply/800/500',
      status: 'pending',
      rejectReason: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };

    db.ownerApplications.unshift(newApp);
    db.auditLogs.unshift({
      id: newId(),
      actorId: user.id,
      actorName: user.fullName,
      action: 'owner_application_created',
      entityType: 'owner_application',
      entityId: newApp.id,
      metadata: { businessName: newApp.businessName },
      createdAt: new Date().toISOString(),
    });
    persist();

    return ok(newApp, 201);
  }),

  http.post('/api/v1/owner-applications', async ({ request }) => {
    await simulateLatency(600);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const body = (await request.json()) as Record<string, unknown>;

    const pendingApp = db.ownerApplications.find((a) => a.user.id === user.id && a.status === 'pending');
    if (pendingApp) {
      return err(409, 'ALREADY_PENDING', 'Bạn đã có một hồ sơ đang chờ xét duyệt');
    }

    const newApp: OwnerApplication = {
      id: newId(),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: (body.phone as string) || user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      businessName: String(body.businessName || 'Cơ sở kinh doanh'),
      taxCode: body.taxCode ? String(body.taxCode) : null,
      idCardUrl: body.idCardUrl ? String(body.idCardUrl) : 'https://picsum.photos/seed/cccd-apply/800/500',
      status: 'pending',
      rejectReason: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };

    db.ownerApplications.unshift(newApp);
    db.auditLogs.unshift({
      id: newId(),
      actorId: user.id,
      actorName: user.fullName,
      action: 'owner_application_created',
      entityType: 'owner_application',
      entityId: newApp.id,
      metadata: { businessName: newApp.businessName },
      createdAt: new Date().toISOString(),
    });
    persist();

    return ok(newApp, 201);
  }),

  http.get('/api/v1/owner/apply', async () => {
    await simulateLatency(250);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const app = db.ownerApplications.find((a) => a.user.id === user.id);
    return ok(app ?? null);
  }),

  http.get('/api/v1/owner-applications/me', async () => {
    await simulateLatency(250);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const app = db.ownerApplications.find((a) => a.user.id === user.id);
    return ok(app ?? null);
  }),
];
