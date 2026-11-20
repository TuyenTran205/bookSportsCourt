import type { Notification, UserRole } from '@bsc/shared';

/**
 * Xác định đường dẫn URL đích khi người dùng nhấn vào một thông báo.
 *
 * Hỗ trợ phân quyền:
 * - `owner`: Điều hướng đến các trang quản lý của chủ sân (/owner/bookings, /owner/payments, v.v.)
 * - `customer`: Điều hướng đến chi tiết đơn đặt sân (/bookings/:id) hoặc cơ sở (/venues/:id).
 */
export function getNotificationTargetUrl(
  item: Notification,
  userRole?: UserRole | string,
): string {
  const payload = (item.payload as Record<string, unknown> | null) ?? {};
  const bookingId = typeof payload.bookingId === 'string' ? payload.bookingId : null;
  const venueId = typeof payload.venueId === 'string' ? payload.venueId : null;
  const venueSlug = typeof payload.venueSlug === 'string' ? payload.venueSlug : null;

  // Luồng dành cho Quản trị viên (Admin)
  if (userRole === 'admin') {
    switch (item.type) {
      case 'abuse_alert':
        return '/admin/bookings';
      case 'owner_application_approved':
      case 'owner_application_rejected':
        return '/admin/owner-applications';
      case 'venue_approved':
      case 'venue_rejected':
        return '/admin/venues';
      default:
        break;
    }
  }

  // Luồng dành cho Chủ sân (Owner)
  if (userRole === 'owner') {
    switch (item.type) {
      case 'payment_submitted':
        return '/owner/payments';
      case 'booking_created':
      case 'booking_confirmed':
      case 'booking_cancelled':
        return '/owner/bookings';
      case 'venue_approved':
      case 'venue_rejected':
        return venueId ? `/owner/venues` : '/owner/venues';
      case 'review_reply':
        return '/owner/reviews';
      default:
        break;
    }
  }

  // Luồng dành cho Khách hàng (Customer) hoặc mặc định
  if (bookingId) {
    return `/bookings/${bookingId}`;
  }

  if (venueSlug) {
    return `/venues/${venueSlug}`;
  }

  if (venueId) {
    return `/venues/${venueId}`;
  }

  // Dựa trên loại thông báo nếu không có ID cụ thể trong payload
  switch (item.type) {
    case 'booking_created':
    case 'booking_confirmed':
    case 'booking_cancelled':
    case 'hold_expired':
      return '/bookings';
    case 'payment_submitted':
    case 'payment_rejected':
      return '/bookings';
    case 'owner_application_approved':
      return '/owner/dashboard';
    case 'owner_application_rejected':
      return '/owner/apply';
    case 'venue_approved':
    case 'venue_rejected':
      return '/owner/venues';
    default:
      return '/notifications';
  }
}
