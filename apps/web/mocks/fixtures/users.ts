import type { OwnerApplication, OwnerProfile, User } from '@bsc/shared';

/**
 * Người dùng mẫu cho cả 3 vai trò.
 *
 * Mật khẩu của mọi tài khoản demo đều là `Password123` (chỉ dùng cho mock —
 * không có ở đâu khác). Ghi rõ ở README của mocks để người dựng UI biết đường
 * đăng nhập thử từng vai trò.
 */

export const DEMO_PASSWORD = 'Password123';

export const users: User[] = [
  // ── Khách đặt sân ───────────────────────────────────────────────────────
  {
    id: '019273c5-7f12-7000-8000-000000000002',
    email: 'khach@example.com',
    fullName: 'Trần Văn Khách',
    phone: '0912345456',
    avatarUrl: null,
    role: 'customer',
    status: 'active',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: '019273c5-7f12-7000-8000-000000000003',
    email: 'linh.nguyen@example.com',
    fullName: 'Nguyễn Thị Linh',
    phone: '0987654321',
    avatarUrl: null,
    role: 'customer',
    status: 'active',
    createdAt: '2026-09-05T09:30:00.000Z',
  },
  {
    id: '019273c5-7f12-7000-8000-000000000004',
    email: 'hung.pham@example.com',
    fullName: 'Phạm Mạnh Hùng',
    phone: '0905111222',
    avatarUrl: null,
    role: 'customer',
    status: 'suspended',
    createdAt: '2026-09-10T14:20:00.000Z',
  },
  {
    id: '019273c5-7f12-7000-8000-000000000005',
    email: 'vy.le@example.com',
    fullName: 'Lê Thảo Vy',
    phone: '0938222333',
    avatarUrl: null,
    role: 'customer',
    status: 'pending',
    createdAt: '2026-10-01T07:15:00.000Z',
  },
  // ── Chủ sân ─────────────────────────────────────────────────────────────
  {
    id: '019273c5-7f12-7000-8000-000000000001',
    email: 'owner@example.com',
    fullName: 'Nguyễn Văn Owner',
    phone: '0901234567',
    avatarUrl: null,
    role: 'owner',
    status: 'active',
    createdAt: '2026-08-15T10:00:00.000Z',
  },
  {
    id: '019273c5-7f12-7000-8000-000000000006',
    email: 'owner2@example.com',
    fullName: 'Đỗ Minh Chủ',
    phone: '0912777888',
    avatarUrl: null,
    role: 'owner',
    status: 'active',
    createdAt: '2026-08-20T11:00:00.000Z',
  },
  // ── Quản trị ────────────────────────────────────────────────────────────
  {
    id: '019273c5-7f12-7000-8000-000000000007',
    email: 'admin@example.com',
    fullName: 'Quản Trị Viên',
    phone: '0909999888',
    avatarUrl: null,
    role: 'admin',
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
];

/** Hồ sơ chủ sân đã được duyệt. */
export const ownerProfiles: OwnerProfile[] = [
  {
    id: '019273c5-7f12-7010-8000-000000000001',
    userId: users[4]!.id,
    businessName: 'Công ty TNHH Thể thao Thăng Long',
    taxCode: '0312345678',
    status: 'approved',
    rejectReason: null,
    createdAt: '2026-08-15T10:05:00.000Z',
  },
  {
    id: '019273c5-7f12-7010-8000-000000000002',
    userId: users[5]!.id,
    businessName: 'Hộ kinh doanh Minh Chủ Sport',
    taxCode: '0319876543',
    status: 'approved',
    rejectReason: null,
    createdAt: '2026-08-20T11:05:00.000Z',
  },
];

/**
 * Đơn xin làm chủ sân – có cả `pending` để màn Admin (A-01) có việc để duyệt
 * và demo được Kịch bản D.
 */
export const ownerApplications: OwnerApplication[] = [
  {
    id: '019273c5-7f12-7020-8000-000000000001',
    user: {
      id: '019273c5-7f12-7000-8000-000000000008',
      email: 'thanh.vo@example.com',
      fullName: 'Võ Chí Thành',
      phone: '0911222333',
      avatarUrl: null,
      role: 'customer',
      status: 'active',
      createdAt: '2026-09-28T08:00:00.000Z',
    },
    businessName: 'Sân bãi Thành Phát',
    taxCode: '0315566778',
    idCardUrl: 'https://picsum.photos/seed/cccd1/800/500',
    status: 'pending',
    rejectReason: null,
    reviewedAt: null,
    createdAt: '2026-10-08T09:30:00.000Z',
  },
  {
    id: '019273c5-7f12-7020-8000-000000000002',
    user: {
      id: '019273c5-7f12-7000-8000-000000000009',
      email: 'mai.bui@example.com',
      fullName: 'Bùi Thanh Mai',
      phone: '0944555666',
      avatarUrl: null,
      role: 'customer',
      status: 'active',
      createdAt: '2026-09-30T10:00:00.000Z',
    },
    businessName: 'CLB Cầu lông Mai Anh',
    taxCode: '0316655443',
    idCardUrl: 'https://picsum.photos/seed/cccd2/800/500',
    status: 'pending',
    rejectReason: null,
    reviewedAt: null,
    createdAt: '2026-10-09T15:45:00.000Z',
  },
  {
    id: '019273c5-7f12-7020-8000-000000000003',
    user: {
      id: '019273c5-7f12-7000-8000-00000000000a',
      email: 'tuan.hoang@example.com',
      fullName: 'Hoàng Anh Tuấn',
      phone: '0966777888',
      avatarUrl: null,
      role: 'customer',
      status: 'active',
      createdAt: '2026-09-12T11:00:00.000Z',
    },
    businessName: 'Sân Pickleball Tuấn Anh',
    taxCode: '0314433221',
    idCardUrl: 'https://picsum.photos/seed/cccd3/800/500',
    status: 'rejected',
    rejectReason: 'Ảnh giấy tờ bị mờ, không đọc được số. Vui lòng chụp lại rõ hơn.',
    reviewedAt: '2026-10-05T10:00:00.000Z',
    createdAt: '2026-10-02T09:00:00.000Z',
  },
];

/** Tài khoản đăng nhập nhanh ở màn Login khi chạy mock. */
export const demoAccounts = [
  { role: 'customer' as const, email: 'khach@example.com', label: 'Khách đặt sân' },
  { role: 'owner' as const, email: 'owner@example.com', label: 'Chủ sân' },
  { role: 'admin' as const, email: 'admin@example.com', label: 'Quản trị viên' },
];
