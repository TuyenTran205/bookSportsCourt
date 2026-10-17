// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { createMockNotification, db } from './db';
import { subscribe } from './realtime';

const CUSTOMER_ID = '019273c5-7f12-7000-8000-000000000002';
const originalNotifications = [...db.notifications];

afterEach(() => {
  db.notifications = [...originalNotifications];
});

describe('mock notification realtime', () => {
  it('emits the contract payload and routes it to the recipient', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribe((event) => received.push(event));

    const notification = createMockNotification(CUSTOMER_ID, {
      type: 'booking_confirmed',
      title: 'Đơn đặt sân đã được xác nhận',
    });
    unsubscribe();

    expect(received).toEqual([
      {
        type: 'notification_created',
        targetUserId: CUSTOMER_ID,
        payload: {
          id: notification.id,
          type: 'booking_confirmed',
          title: 'Đơn đặt sân đã được xác nhận',
        },
      },
    ]);
  });
});
