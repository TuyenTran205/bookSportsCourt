// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Booking, BookingStatus } from '@bsc/shared';
import { db } from '../db';
import { server } from '../server';

const OWNER_ID = '019273c5-7f12-7000-8000-000000000001';
const OTHER_OWNER_ID = '019273c5-7f12-7000-8000-000000000006';
const CUSTOMER_ID = '019273c5-7f12-7000-8000-000000000002';

const originalCurrentUserId = db.currentUserId;
const originalBookings = db.bookings.map((b) => ({
  ...b,
  booking: { ...b.booking, during: { ...b.booking.during } },
}));
const originalNotifications = db.notifications.map((n) => ({ ...n }));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  db.currentUserId = OWNER_ID;
  db.bookings = originalBookings.map((b) => ({
    ...b,
    booking: { ...b.booking, during: { ...b.booking.during } },
  }));
  db.notifications = originalNotifications.map((n) => ({ ...n }));
});

afterEach(() => {
  server.resetHandlers();
  db.currentUserId = originalCurrentUserId;
  db.bookings = originalBookings.map((b) => ({
    ...b,
    booking: { ...b.booking, during: { ...b.booking.during } },
  }));
  db.notifications = originalNotifications.map((n) => ({ ...n }));
});

function createMockBooking(overrides: Partial<Booking> = {}): Booking {
  const courtId = db.venues.find((v) => v.ownerId === OWNER_ID)?.courts[0]?.id ?? 'court-1';
  const pastStart = new Date(Date.now() - 3600 * 1000).toISOString();
  const pastEnd = new Date(Date.now() - 1800 * 1000).toISOString();

  return {
    id: `booking-test-${Math.random().toString(36).slice(2)}`,
    courtId,
    customerId: CUSTOMER_ID,
    source: 'online',
    guestName: null,
    guestPhone: null,
    during: {
      start: pastStart,
      end: pastEnd,
    },
    status: 'confirmed',
    totalPrice: 100000,
    depositAmount: 50000,
    note: null,
    expiresAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    ...overrides,
  };
}

describe('OWN-09: No-show handler & logic (POST /api/v1/owner/bookings/:id/no-show)', () => {
  it('TC-NOSHOW-01: từ chối 401 khi chưa đăng nhập', async () => {
    db.currentUserId = null;
    const testBooking = createMockBooking();
    db.bookings.unshift({ booking: testBooking, payment: null, review: null });

    const res = await fetch(`http://localhost:3000/api/v1/owner/bookings/${testBooking.id}/no-show`, {
      method: 'POST',
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  it('TC-NOSHOW-02: từ chối 403 khi người dùng là customer', async () => {
    db.currentUserId = CUSTOMER_ID;
    const testBooking = createMockBooking();
    db.bookings.unshift({ booking: testBooking, payment: null, review: null });

    const res = await fetch(`http://localhost:3000/api/v1/owner/bookings/${testBooking.id}/no-show`, {
      method: 'POST',
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('TC-NOSHOW-03: từ chối 404 khi không tìm thấy đơn đặt sân', async () => {
    const res = await fetch('http://localhost:3000/api/v1/owner/bookings/non-existent-id/no-show', {
      method: 'POST',
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('TC-NOSHOW-04: từ chối 403 khi chủ sân không sở hữu cơ sở của đơn đặt sân', async () => {
    db.currentUserId = OTHER_OWNER_ID; // Chủ sân khác
    const testBooking = createMockBooking(); // Thuộc sân của OWNER_ID
    db.bookings.unshift({ booking: testBooking, payment: null, review: null });

    const res = await fetch(`http://localhost:3000/api/v1/owner/bookings/${testBooking.id}/no-show`, {
      method: 'POST',
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('TC-NOSHOW-05: từ chối 422 khi trạng thái đơn không phải confirmed (ví dụ cancelled, completed)', async () => {
    const statuses: BookingStatus[] = ['pending_payment', 'completed', 'cancelled'];

    for (const status of statuses) {
      const testBooking = createMockBooking({ status });
      db.bookings.unshift({ booking: testBooking, payment: null, review: null });

      const res = await fetch(
        `http://localhost:3000/api/v1/owner/bookings/${testBooking.id}/no-show`,
        { method: 'POST' },
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error?.code).toBe('INVALID_STATUS');
    }
  });

  it('TC-NOSHOW-06: từ chối 422 khi chưa đến giờ bắt đầu trận đấu (booking in the future)', async () => {
    const futureStart = new Date(Date.now() + 3600 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 5400 * 1000).toISOString();
    const testBooking = createMockBooking({
      status: 'confirmed',
      during: { start: futureStart, end: futureEnd },
    });
    db.bookings.unshift({ booking: testBooking, payment: null, review: null });

    const res = await fetch(`http://localhost:3000/api/v1/owner/bookings/${testBooking.id}/no-show`, {
      method: 'POST',
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe('BOOKING_NOT_STARTED');
  });

  it('TC-NOSHOW-07: thành công khi đơn confirmed và thời gian bắt đầu trong quá khứ', async () => {
    const testBooking = createMockBooking({ status: 'confirmed' });
    db.bookings.unshift({ booking: testBooking, payment: null, review: null });

    const notifCountBefore = db.notifications.length;

    const res = await fetch(`http://localhost:3000/api/v1/owner/bookings/${testBooking.id}/no-show`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.status).toBe('no_show');

    // Kiểm tra state đã được cập nhật trong db
    const updatedInDb = db.bookings.find((b) => b.booking.id === testBooking.id);
    expect(updatedInDb?.booking.status).toBe('no_show');

    // Kiểm tra đã tạo thông báo cho khách hàng
    expect(db.notifications.length).toBeGreaterThan(notifCountBefore);
    const customerNotif = db.notifications.find(
      (n) => n.userId === CUSTOMER_ID && n.title === 'Đơn đặt sân ghi nhận vắng mặt',
    );
    expect(customerNotif).toBeDefined();
  });
});

describe('canMarkNoShow business rule logic', () => {
  function canMarkNoShow(booking: { status: string; during: { start: string } }): boolean {
    return booking.status === 'confirmed' && new Date() > new Date(booking.during.start);
  }

  it('trả về true khi đơn confirmed và đã quá giờ bắt đầu', () => {
    const booking = {
      status: 'confirmed',
      during: { start: new Date(Date.now() - 1000).toISOString() },
    };
    expect(canMarkNoShow(booking)).toBe(true);
  });

  it('trả về false khi đơn confirmed nhưng giờ bắt đầu ở tương lai', () => {
    const booking = {
      status: 'confirmed',
      during: { start: new Date(Date.now() + 60000).toISOString() },
    };
    expect(canMarkNoShow(booking)).toBe(false);
  });

  it('trả về false khi đơn ở trạng thái khác dù đã quá giờ bắt đầu', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(canMarkNoShow({ status: 'cancelled', during: { start: past } })).toBe(false);
    expect(canMarkNoShow({ status: 'completed', during: { start: past } })).toBe(false);
    expect(canMarkNoShow({ status: 'no_show', during: { start: past } })).toBe(false);
    expect(canMarkNoShow({ status: 'pending_payment', during: { start: past } })).toBe(false);
  });
});
