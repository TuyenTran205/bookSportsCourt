import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db, type MockNotification } from '../db';
import {
  countUnreadNotifications,
  getUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from './notifications';

const OWNER_ID = '019273c5-7f12-7000-8000-000000000001';
const CUSTOMER_ID = '019273c5-7f12-7000-8000-000000000002';
const originalCurrentUserId = db.currentUserId;
const originalNotifications = db.notifications.map((notification) => ({ ...notification }));
const makeNotification = (id: string, userId: string): MockNotification => ({
  id,
  userId,
  type: 'booking_confirmed',
  title: `Notification for ${userId}`,
  body: null,
  readAt: null,
  createdAt: new Date().toISOString(),
  payload: null,
});

const ownerNotification = makeNotification('owner-notification', OWNER_ID);
const customerNotification = makeNotification('customer-notification', CUSTOMER_ID);

beforeEach(() => {
  db.currentUserId = OWNER_ID;
  db.notifications = [
    { ...ownerNotification },
    { ...customerNotification },
  ];
});

afterEach(() => {
  db.currentUserId = originalCurrentUserId;
  db.notifications = originalNotifications.map((notification) => ({ ...notification }));
});

describe('notification handlers', () => {
  it('lists only the current user notifications and omits internal recipient IDs', () => {
    const ownerNotifications = getUserNotifications(OWNER_ID);
    const customerNotifications = getUserNotifications(CUSTOMER_ID);

    expect(ownerNotifications).toHaveLength(1);
    expect(ownerNotifications[0]).not.toHaveProperty('userId');
    expect(customerNotifications.map(({ id }) => id)).toEqual(['customer-notification']);
  });

  it('counts unread notifications per user', () => {
    expect(countUnreadNotifications(OWNER_ID)).toBe(1);
    expect(countUnreadNotifications(CUSTOMER_ID)).toBe(1);
  });

  it('will not mark another user notification as read', () => {
    expect(markUserNotificationRead(OWNER_ID, 'customer-notification')).toBeUndefined();
    expect(db.notifications.find(({ id }) => id === 'customer-notification')?.readAt).toBeNull();
  });

  it('marks all and counts only the current user notifications', () => {
    expect(markAllUserNotificationsRead(OWNER_ID)).toBe(1);
    expect(countUnreadNotifications(OWNER_ID)).toBe(0);
    expect(countUnreadNotifications(CUSTOMER_ID)).toBe(1);
    expect(db.notifications.find(({ id }) => id === 'owner-notification')?.readAt).not.toBeNull();
    expect(db.notifications.find(({ id }) => id === 'customer-notification')?.readAt).toBeNull();
  });
});
