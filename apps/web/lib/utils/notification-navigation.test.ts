import { describe, expect, it } from 'vitest';
import type { Notification } from '@bsc/shared';
import { getNotificationTargetUrl } from './notification-navigation';

describe('getNotificationTargetUrl', () => {
  const baseNotification: Notification = {
    id: 'notif-1',
    type: 'booking_cancelled',
    title: 'Đơn đặt sân đã bị huỷ',
    body: 'Đơn đặt sân của bạn đã bị huỷ.',
    readAt: null,
    createdAt: '2026-11-20T08:00:00.000Z',
    payload: null,
  };

  it('điều hướng đến /bookings/:id khi thông báo có payload.bookingId', () => {
    const item: Notification = {
      ...baseNotification,
      payload: { bookingId: 'booking-123' },
    };
    expect(getNotificationTargetUrl(item, 'customer')).toBe('/bookings/booking-123');
  });

  it('điều hướng đến /owner/bookings khi owner nhận thông báo booking_cancelled', () => {
    const item: Notification = {
      ...baseNotification,
      type: 'booking_cancelled',
      payload: { bookingId: 'booking-123' },
    };
    expect(getNotificationTargetUrl(item, 'owner')).toBe('/owner/bookings');
  });

  it('điều hướng đến /owner/payments khi owner nhận thông báo payment_submitted', () => {
    const item: Notification = {
      ...baseNotification,
      type: 'payment_submitted',
      payload: { bookingId: 'booking-123', paymentId: 'pay-456' },
    };
    expect(getNotificationTargetUrl(item, 'owner')).toBe('/owner/payments');
  });

  it('điều hướng đến /venues/:slug khi có venueSlug', () => {
    const item: Notification = {
      ...baseNotification,
      type: 'review_reply',
      payload: { venueSlug: 'san-cau-long-quan-7' },
    };
    expect(getNotificationTargetUrl(item, 'customer')).toBe('/venues/san-cau-long-quan-7');
  });

  it('điều hướng fallback /bookings cho thông báo loại booking không có ID', () => {
    const item: Notification = {
      ...baseNotification,
      type: 'booking_confirmed',
      payload: null,
    };
    expect(getNotificationTargetUrl(item, 'customer')).toBe('/bookings');
  });

  it('điều hướng đến /admin/bookings khi admin nhận thông báo abuse_alert', () => {
    const item: Notification = {
      ...baseNotification,
      type: 'abuse_alert',
      payload: { customerId: 'cust-123', courtId: 'court-456' },
    };
    expect(getNotificationTargetUrl(item, 'admin')).toBe('/admin/bookings');
  });

  it('điều hướng fallback /notifications cho thông báo không có type khớp', () => {
    const item: Notification = {
      ...baseNotification,
      // @ts-expect-error test unknown type
      type: 'unknown_type',
      payload: null,
    };
    expect(getNotificationTargetUrl(item, 'customer')).toBe('/notifications');
  });
});
