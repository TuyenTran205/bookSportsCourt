import { http } from 'msw';
import type { AuditLog } from '@bsc/shared';
import { createMockNotification, db, currentUser, persist } from '../db';
import { areas, sports } from '../fixtures/catalogs';
import { venueIdByCourtId } from '../fixtures/bookings';
import { venues } from '../fixtures/venues';
import { err, ok, okList, paginate, readPaging, simulateLatency } from '../utils';

/** Khu vực quản trị: chỉ vai trò `admin` đi qua. */
function requireAdmin() {
  const user = currentUser();
  if (!user) return { error: err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập') };
  if (user.role !== 'admin') {
    return { error: err(403, 'FORBIDDEN', 'Khu vực này chỉ dành cho quản trị viên') };
  }
  return { user };
}

/** Nhật ký kiểm toán sinh tại chỗ cho màn A-06. */
function auditLogs(): AuditLog[] {
  return [...db.auditLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Ghi một dòng kiểm toán.
 *
 * ADM-09 yêu cầu ghi lại MỌI hành động admin và không cho sửa/xoá, nên mọi
 * thao tác duyệt/từ chối đều phải đi qua đây.
 */
function writeAudit(
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> | null = null,
): void {
  const actor = currentUser();
  db.auditLogs.push({
    id: `019273c5-7f18-7000-9000-${String(db.auditLogs.length + 1).padStart(12, '0')}`,
    actorId: actor?.id ?? null,
    actorName: actor?.fullName ?? 'Hệ thống',
    action,
    entityType,
    entityId,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

export const adminHandlers = [
  /** Thống kê tổng quan cho dashboard. */
  http.get('/api/v1/admin/stats', async () => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const active = db.bookings.filter((b) => !['cancelled', 'expired'].includes(b.booking.status));

    return ok({
      totalUsers: db.users.length,
      totalVenues: venues.length,
      totalBookings: db.bookings.length,
      totalRevenue: active.reduce((s, b) => s + b.booking.totalPrice, 0),
      pendingOwnerApplications: db.ownerApplications.filter((a) => a.status === 'pending').length,
      pendingVenues: venues.filter((v) => v.status === 'pending').length,
    });
  }),

  // ── Duyệt hồ sơ chủ sân & cơ sở (A-01) ───────────────────────────────────
  http.get('/api/v1/admin/owner-applications', async ({ request }) => {
    await simulateLatency(350);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const status = url.searchParams.get('status');

    let list = [...db.ownerApplications];
    if (status) list = list.filter((a) => a.status === status);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const { data, meta } = paginate(list, page, limit);
    return okList(data, meta);
  }),

  /**
   * Duyệt/từ chối hồ sơ chủ sân.
   *
   * docs/11-api-contract.md gộp cả hai hành động vào MỘT route với body
   * `{ status, reviewNote }` — không có `/approve` và `/reject` riêng.
   */
  http.patch('/api/v1/admin/owner-applications/:id', async ({ params, request }) => {
    await simulateLatency(450);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const app = db.ownerApplications.find((a) => a.id === params.id);
    if (!app) return err(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ');

    const body = (await request.json()) as {
      status?: 'approved' | 'rejected';
      reviewNote?: string;
    };
    if (body.status !== 'approved' && body.status !== 'rejected') {
      return err(422, 'VALIDATION_ERROR', 'Trạng thái không hợp lệ');
    }
    // Từ chối bắt buộc kèm lý do để người nộp biết đường sửa.
    if (body.status === 'rejected' && !body.reviewNote?.trim()) {
      return err(422, 'VALIDATION_ERROR', 'Vui lòng nhập lý do từ chối');
    }

    app.status = body.status;
    app.reviewedAt = new Date().toISOString();
    app.rejectReason = body.status === 'rejected' ? (body.reviewNote ?? null) : null;

    // Duyệt hồ sơ thì người dùng được nâng lên vai trò chủ sân.
    if (body.status === 'approved') {
      const user = db.users.find((u) => u.id === app.user.id);
      if (user) user.role = 'owner';
    }
    // Ghi chú duyệt/từ chối không có chỗ trong `OwnerApplication`, nên lưu vào
    // metadata của nhật ký kiểm toán — nơi ADM-09 vốn đã yêu cầu ghi lại.
    writeAudit(`owner_application.${body.status}`, 'owner_application', app.id, {
      reviewNote: body.reviewNote ?? null,
      applicant: app.user.fullName,
    });
    persist();
    createMockNotification(app.user.id, {
      type: body.status === 'approved' ? 'owner_application_approved' : 'owner_application_rejected',
      title:
        body.status === 'approved'
          ? 'Hồ sơ chủ sân đã được duyệt'
          : 'Hồ sơ chủ sân chưa được duyệt',
      body:
        body.status === 'approved'
          ? 'Bạn có thể bắt đầu thêm cơ sở và sân con.'
          : body.reviewNote?.trim() ?? 'Vui lòng cập nhật hồ sơ và gửi lại.',
      payload: { applicationId: app.id },
    });

    return ok(app);
  }),

  /** Duyệt cơ sở. */
  http.get('/api/v1/admin/venues', async ({ request }) => {
    await simulateLatency(350);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const status = url.searchParams.get('status');

    let list = venues.map((v) => ({
      ...v,
      ownerName: db.users.find((u) => u.id === v.ownerId)?.fullName ?? '—',
    }));
    if (status) list = list.filter((v) => v.status === status);

    const { data, meta } = paginate(list, page, limit);
    return okList(data, meta);
  }),

  /** Duyệt/từ chối cơ sở — cùng quy ước gộp route như hồ sơ chủ sân. */
  http.patch('/api/v1/admin/venues/:id', async ({ params, request }) => {
    await simulateLatency(450);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const venue = venues.find((v) => v.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');

    const body = (await request.json()) as {
      status?: 'approved' | 'rejected' | 'suspended';
      reviewNote?: string;
    };
    if (!body.status || !['approved', 'rejected', 'suspended'].includes(body.status)) {
      return err(422, 'VALIDATION_ERROR', 'Trạng thái không hợp lệ');
    }
    if (body.status === 'rejected' && !body.reviewNote?.trim()) {
      return err(422, 'VALIDATION_ERROR', 'Vui lòng nhập lý do từ chối');
    }

    venue.status = body.status;
    // Lý do không nằm trong `VenueDetail` — ghi vào nhật ký kiểm toán, cùng
    // cách xử lý như hồ sơ chủ sân ở trên.
    writeAudit(`venue.${body.status}`, 'venue', venue.id, {
      reviewNote: body.reviewNote ?? null,
      venueName: venue.name,
    });
    persist();
    if (body.status === 'approved' || body.status === 'rejected') {
      createMockNotification(venue.ownerId, {
        type: body.status === 'approved' ? 'venue_approved' : 'venue_rejected',
        title:
          body.status === 'approved'
            ? 'Cơ sở đã được duyệt'
            : 'Cơ sở chưa được duyệt',
        body:
          body.status === 'approved'
            ? `${venue.name} đã hiển thị với khách hàng.`
            : body.reviewNote?.trim() ?? `Vui lòng cập nhật thông tin của ${venue.name}.`,
        payload: { venueId: venue.id },
      });
    }

    return ok(venue);
  }),

  // ── Người dùng & phân quyền (A-02) ───────────────────────────────────────
  http.get('/api/v1/admin/users', async ({ request }) => {
    await simulateLatency(350);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const role = url.searchParams.get('role');

    let list = [...db.users];
    if (q) {
      list = list.filter(
        (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    if (role) list = list.filter((u) => u.role === role);

    const { data, meta } = paginate(list, page, limit);
    return okList(data, meta);
  }),

  http.get('/api/v1/admin/users/:id', async ({ params }) => {
    await simulateLatency(250);
    const guard = requireAdmin();
    if (guard.error) return guard.error;
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return err(404, 'NOT_FOUND', 'Không tìm thấy người dùng');
    return ok(user);
  }),

  http.patch('/api/v1/admin/users/:id/role', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const user = db.users.find((u) => u.id === params.id);
    if (!user) return err(404, 'NOT_FOUND', 'Không tìm thấy người dùng');

    const body = (await request.json()) as { role: typeof user.role };
    user.role = body.role;
    persist();
    return ok(user);
  }),

  http.patch('/api/v1/admin/users/:id/status', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const user = db.users.find((u) => u.id === params.id);
    if (!user) return err(404, 'NOT_FOUND', 'Không tìm thấy người dùng');
    if (user.role === 'admin') {
      return err(403, 'FORBIDDEN', 'Không thể khoá tài khoản quản trị viên');
    }

    const body = (await request.json()) as { status: typeof user.status };
    user.status = body.status;
    persist();
    return ok(user);
  }),

  // ── Danh mục hệ thống (A-03) ─────────────────────────────────────────────
  http.post('/api/v1/admin/sports', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const body = (await request.json()) as { name: string; icon?: string };
    const newSport = {
      id: `019273c5-7f00-7001-0000-${String(Date.now()).slice(-12)}`,
      name: body.name,
      slug: body.name.toLowerCase().replace(/\s+/g, '-'),
      icon: body.icon ?? 'activity',
    };
    sports.push(newSport);
    writeAudit('catalog.sport_create', 'sport', newSport.name, { name: newSport.name });
    persist();
    return ok(newSport, 201);
  }),

  http.patch('/api/v1/admin/sports/:id', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;
    const body = (await request.json()) as Record<string, unknown>;
    const sport = sports.find((s) => s.id === params.id);
    if (sport && typeof body.name === 'string') {
      sport.name = body.name;
    }
    persist();
    return ok({ ...body, id: params.id });
  }),

  http.delete('/api/v1/admin/sports/:id', async ({ params }) => {
    await simulateLatency(350);
    const guard = requireAdmin();
    if (guard.error) return guard.error;
    const idx = sports.findIndex((s) => s.id === params.id);
    if (idx !== -1) {
      const removed = sports.splice(idx, 1)[0];
      if (removed) {
        writeAudit('catalog.sport_delete', 'sport', removed.name, { name: removed.name });
      }
    }
    persist();
    return ok({ success: true });
  }),

  http.post('/api/v1/admin/areas', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const body = (await request.json()) as { name: string; type: 'province' | 'district'; parentId?: string };
    const newArea = {
      id: `019273c5-7f00-7000-0000-${String(Date.now()).slice(-12)}`,
      name: body.name,
      slug: body.name.toLowerCase().replace(/\s+/g, '-'),
      type: body.type,
      parentId: body.parentId ?? null,
    };
    areas.push(newArea);
    writeAudit('catalog.area_create', 'area', newArea.name, { name: newArea.name, type: newArea.type });
    persist();
    return ok(newArea, 201);
  }),

  // ── Giám sát toàn bộ đơn (A-04) ──────────────────────────────────────────
  http.get('/api/v1/admin/bookings', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q')?.toLowerCase();

    let list = db.bookings.map((r) => ({
      ...r.booking,
      courtName: venues
        .flatMap((v) => v.courts)
        .find((c) => c.id === r.booking.courtId)?.name ?? 'Sân',
      venueName: venues.find((v) => v.id === (venueIdByCourtId[r.booking.courtId] ?? ''))?.name ?? '',
      customerName:
        db.users.find((u) => u.id === r.booking.customerId)?.fullName ??
        r.booking.guestName ??
        'Khách vãng lai',
      paymentStatus: r.payment?.status ?? null,
      source: r.booking.source,
    }));

    if (status) list = list.filter((b) => b.status === status);
    if (q) {
      list = list.filter(
        (b) =>
          b.venueName.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const { data, meta } = paginate(list, page, limit);
    return okList(data, meta);
  }),

  /** Admin huỷ đơn hộ (tranh chấp). */
  http.patch('/api/v1/admin/bookings/:id/cancel', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const record = db.bookings.find((b) => b.booking.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy đơn');
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    record.booking.status = 'cancelled';
    record.booking.cancelledAt = new Date().toISOString();
    record.booking.cancelReason = body.reason?.trim() || 'Quản trị viên huỷ';
    writeAudit('booking.force_cancel', 'booking', record.booking.id, {
      reason: record.booking.cancelReason,
    });
    persist();
    return ok(record.booking);
  }),
  http.post('/api/v1/admin/bookings/:id/cancel', async ({ params }) => {
    await simulateLatency(400);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const record = db.bookings.find((b) => b.booking.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy đơn');
    record.booking.status = 'cancelled';
    record.booking.cancelledAt = new Date().toISOString();
    record.booking.cancelReason = 'Quản trị viên huỷ';
    writeAudit('booking.force_cancel', 'booking', record.booking.id, {
      reason: record.booking.cancelReason,
    });
    persist();
    return ok(record.booking);
  }),

  // ── Thống kê toàn hệ thống (A-05) ────────────────────────────────────────
  http.get('/api/v1/admin/analytics', async () => {
    await simulateLatency(450);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const byStatus = ['held', 'pending_payment', 'confirmed', 'completed', 'cancelled', 'expired', 'no_show'].map(
      (status) => ({
        status,
        count: db.bookings.filter((b) => b.booking.status === status).length,
      }),
    );

    const bySport = ['Cầu lông', 'Bóng đá', 'Pickleball', 'Tennis'].map((sport) => ({
      sport,
      bookings: db.bookings.filter((b) => {
        const vid = venueIdByCourtId[b.booking.courtId] ?? '';
        return venues.find((v) => v.id === vid)?.sports.some((s) => s.name === sport) ?? false;
      }).length,
    }));

    const byVenue = venues.map((v) => ({
      venueId: v.id,
      name: v.name,
      bookings: db.bookings.filter((b) => (venueIdByCourtId[b.booking.courtId] ?? '') === v.id).length,
      revenue: db.bookings
        .filter(
          (b) =>
            (venueIdByCourtId[b.booking.courtId] ?? '') === v.id &&
            ['confirmed', 'completed'].includes(b.booking.status),
        )
        .reduce((s, b) => s + b.booking.totalPrice, 0),
    }));

    return ok({ byStatus, bySport, byVenue });
  }),

  // ── Nhật ký kiểm toán (A-06) ─────────────────────────────────────────────
  http.get('/api/v1/admin/audit-logs', async ({ request }) => {
    await simulateLatency(350);
    const guard = requireAdmin();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const { data, meta } = paginate(auditLogs(), page, limit);
    return okList(data, meta);
  }),

  /** Đặt lại toàn bộ dữ liệu mẫu — nút tiện dụng khi demo. */
  http.post('/api/v1/admin/reset-mock', async () => {
    const { resetMockDb } = await import('../db');
    resetMockDb();
    return ok({ success: true });
  }),
];
