import { adminHandlers } from './admin';
import { authHandlers } from './auth';
import { bookingHandlers } from './bookings';
import { catalogHandlers } from './catalog';
import { notificationHandlers } from './notifications';
import { ownerHandlers } from './owner';
import { venueHandlers } from './venues';

/**
 * Toàn bộ handler của MSW.
 *
 * Gộp theo module khớp cách chia ở docs/11-api-contract.md để khi backend thật
 * xuất hiện thì đối chiếu từng nhóm một.
 */
export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...venueHandlers,
  ...bookingHandlers,
  ...ownerHandlers,
  ...notificationHandlers,
  ...adminHandlers,
];
