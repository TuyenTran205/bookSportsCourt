import type {
  Area,
  AuditLog,
  Booking,
  BookingSource,
  BookingStatus,
  OwnerApplication,
  OwnerApplicationStatus,
  PaymentStatus,
  Review,
  Sport,
  User,
  UserRole,
  UserStatus,
  VenueListItem,
} from '@bsc/shared';

import { apiFetch, apiFetchWithMeta, jsonBody } from '../client';

/**
 * Endpoint module – Quản trị.
 * Khớp `mocks/handlers/admin.ts` và `docs/11-api-contract.md` mục Admin.
 *
 * Duyệt/từ chối dùng CHUNG một route `PATCH .../:id` với body
 * `{ status, reviewNote }` — không có `/approve` và `/reject` riêng.
 */

/**
 * Thẻ số liệu tổng quan cho dashboard (A-05).
 *
 * Định nghĩa tại đây thay vì trong `@bsc/shared` vì mock hiện chỉ trả tập con
 * của hợp đồng (hợp đồng còn mô tả chuỗi thời gian cho biểu đồ ADM-08 chưa
 * làm). Khi backend bổ sung phần còn thiếu thì mở rộng type này và chuyển vào
 * `packages/shared` cùng lúc.
 */
export interface AdminStats {
  totalUsers: number;
  totalVenues: number;
  totalBookings: number;
  totalRevenue: number;
  pendingOwnerApplications: number;
  pendingVenues: number;
}

export interface AdminAnalytics {
  byStatus: Array<{ status: string; count: number }>;
  bySport: Array<{ sport: string; bookings: number }>;
  byVenue: Array<{ venueId: string; name: string; bookings: number; revenue: number }>;
}

export function getAdminAnalytics() {
  return apiFetch<AdminAnalytics>('/admin/analytics');
}

/** Cơ sở kèm tên chủ sân — dữ liệu chỉ có ở màn quản trị. */
export type AdminVenueRow = VenueListItem & { ownerName: string };

export function getAdminStats() {
  return apiFetch<AdminStats>('/admin/stats');
}

// ── Hồ sơ chủ sân (ADM-01) ─────────────────────────────────────────────────

export function listOwnerApplications(
  params: { status?: OwnerApplicationStatus; page?: number; limit?: number } = {},
) {
  return apiFetchWithMeta<OwnerApplication[]>('/admin/owner-applications', {
    query: { ...params },
  });
}

/** Duyệt hoặc từ chối. `reviewNote` bắt buộc khi `status = 'rejected'`. */
export function reviewOwnerApplication(
  id: string,
  input: { status: 'approved' | 'rejected'; reviewNote?: string },
) {
  return apiFetch<OwnerApplication>(`/admin/owner-applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    ...jsonBody(input),
  });
}

// ── Cơ sở (ADM-02) ─────────────────────────────────────────────────────────

export function listAdminVenues(
  params: { status?: string; page?: number; limit?: number } = {},
) {
  return apiFetchWithMeta<AdminVenueRow[]>('/admin/venues', { query: { ...params } });
}

export function reviewVenue(
  id: string,
  input: { status: 'approved' | 'rejected' | 'suspended'; reviewNote?: string },
) {
  return apiFetch<AdminVenueRow>(`/admin/venues/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    ...jsonBody(input),
  });
}

// ── Người dùng (ADM-03) ────────────────────────────────────────────────────

export function listAdminUsers(
  params: { role?: UserRole; status?: UserStatus; q?: string; page?: number; limit?: number } = {},
) {
  return apiFetchWithMeta<User[]>('/admin/users', { query: { ...params } });
}

/** Khoá hoặc mở khoá tài khoản. */
export function setUserStatus(id: string, status: UserStatus) {
  return apiFetch<User>(`/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    ...jsonBody({ status }),
  });
}

export function setUserRole(id: string, role: UserRole) {
  return apiFetch<User>(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    ...jsonBody({ role }),
  });
}

// ── Đặt sân (ADM-04) ───────────────────────────────────────────────────────

export interface AdminBookingRow extends Booking {
  courtName: string;
  venueName: string;
  customerName: string;
  paymentStatus: PaymentStatus | null;
  source: BookingSource;
}

export function listAdminBookings(
  params: { status?: BookingStatus; q?: string; page?: number; limit?: number } = {},
) {
  return apiFetchWithMeta<AdminBookingRow[]>('/admin/bookings', { query: { ...params } });
}

/** Buộc huỷ một lượt đặt — kèm lý do để ghi vào nhật ký. */
export function forceCancelBooking(id: string, reason: string) {
  return apiFetch<Booking>(`/admin/bookings/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    ...jsonBody({ reason }),
  });
}

// ── Danh mục (ADM-05) ──────────────────────────────────────────────────────

export function createSport(input: { name: string; icon?: string }) {
  return apiFetch<Sport>('/admin/sports', { method: 'POST', ...jsonBody(input) });
}

export function deleteSport(id: string) {
  return apiFetch<{ success: true }>(`/admin/sports/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function createArea(input: { name: string; type: 'province' | 'district'; parentId?: string }) {
  return apiFetch<Area>('/admin/areas', { method: 'POST', ...jsonBody(input) });
}

// ── Đánh giá (ADM-06) ──────────────────────────────────────────────────────

export function listAdminReviews(
  params: { venueId?: string; isVisible?: boolean; page?: number; limit?: number } = {},
) {
  return apiFetchWithMeta<Review[]>('/admin/reviews', { query: { ...params } });
}

/** Ẩn/hiện một đánh giá. */
export function setReviewVisibility(id: string, isVisible: boolean) {
  return apiFetch<Review>(`/admin/reviews/${encodeURIComponent(id)}/visibility`, {
    method: 'PATCH',
    ...jsonBody({ isVisible }),
  });
}

// ── Nhật ký kiểm toán (ADM-09) ─────────────────────────────────────────────
// Chỉ có `GET`: nhật ký không sửa và không xoá được.

export function listAuditLogs(params: { page?: number; limit?: number } = {}) {
  return apiFetchWithMeta<AuditLog[]>('/admin/audit-logs', { query: { ...params } });
}

/** Nạp lại dữ liệu mock về trạng thái ban đầu — chỉ dùng khi phát triển. */
export function resetMockData() {
  return apiFetch<{ success: true }>('/admin/reset-mock', { method: 'POST' });
}
