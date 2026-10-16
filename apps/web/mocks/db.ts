import type { AuditLog, BankAccountInfo, Booking, Notification, OpeningHour, Review, User } from '@bsc/shared';
import { cloneBookings, initialBookings, type BookingRecord } from './fixtures/bookings';
import { ownerApplications, users as initialUsers } from './fixtures/users';
import {
  blackouts as initialBlackouts,
  openingHours as initialOpeningHours,
  venues as initialVenues,
} from './fixtures/venues';

/**
 * "Cơ sở dữ liệu" trong bộ nhớ của MSW.
 *
 * Vì sao cần state sống thay vì trả fixture tĩnh: để bấm tay được trọn một
 * vòng nghiệp vụ — giữ chỗ → gửi biên lai → chủ sân duyệt → slot đổi màu.
 *
 * State được đồng bộ qua `localStorage` để **hai tab trình duyệt dùng chung một
 * nguồn dữ liệu**. Đây là điều kiện để demo Kịch bản B (race condition): tab A
 * giữ chỗ thành công thì tab B phải nhận 409 khi giữ đúng khung giờ đó. Nếu chỉ
 * giữ state trong bộ nhớ, mỗi tab là một thế giới riêng và không demo được.
 */

const STORAGE_KEY = 'bsc-mock-db-v1';
const USER_SESSION_KEY = 'bsc-mock-user-id';

const seedCourtIdsByBookingId = new Map(
  initialBookings.map(({ booking }) => [booking.id, booking.courtId]),
);
const currentCourtIds = new Set(initialVenues.flatMap((venue) => venue.courts.map((court) => court.id)));
const legacyCourtsById = new Map(
  initialVenues.flatMap((venue) =>
    venue.courts.map((court, index) => [
      `${venue.id.slice(0, 24)}${String(index + 1).padStart(4, '0')}`,
      court,
    ] as const),
  ),
);

function migrateBookingCourtIds(bookings: BookingRecord[]): BookingRecord[] {
  return bookings.map((record) => {
    const seededCourtId = seedCourtIdsByBookingId.get(record.booking.id);
    const courtId = seededCourtId ??
      (currentCourtIds.has(record.booking.courtId)
        ? record.booking.courtId
        : legacyCourtsById.get(record.booking.courtId)?.id);

    if (!courtId || courtId === record.booking.courtId) return record;
    return { ...record, booking: { ...record.booking, courtId } };
  });
}

function readSavedUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(USER_SESSION_KEY) ?? window.localStorage.getItem(USER_SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveCurrentUserId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      window.sessionStorage.setItem(USER_SESSION_KEY, id);
      window.localStorage.setItem(USER_SESSION_KEY, id);
    } else {
      window.sessionStorage.removeItem(USER_SESSION_KEY);
      window.localStorage.removeItem(USER_SESSION_KEY);
    }
  } catch {
    /* bỏ qua */
  }
}

export interface MockDb {
  users: User[];
  bookings: BookingRecord[];
  reviews: Review[];
  notifications: Notification[];
  ownerApplications: typeof ownerApplications;
  blackouts: typeof initialBlackouts;
  openingHours: OpeningHour[];
  bankAccounts: Record<string, BankAccountInfo>;
  /** Nhật ký kiểm toán (ADM-09) — chỉ ghi thêm, không sửa/xoá. */
  auditLogs: AuditLog[];
  /** Người dùng đang đăng nhập; `null` = khách vãng lai. */
  currentUserId: string | null;
}

/**
 * Vài dòng kiểm toán mẫu để màn A-06 có dữ liệu ngay khi mở.
 *
 * Mốc thời gian tính tương đối so với lúc khởi tạo để bảng luôn trông "mới",
 * thay vì cứng ngày tháng sẽ cũ đi theo thời gian.
 */
function seedAuditLogs(): AuditLog[] {
  const admin = initialUsers.find((u) => u.role === 'admin');
  const now = Date.now();
  const entries: Array<[string, string, string, number]> = [
    ['owner_application.approve', 'owner_application', 'Võ Chí Thành – Sân bãi Thành Phát', 1],
    ['venue.approve', 'venue', 'Sân Cầu Lông Thăng Long', 2],
    ['user.suspend', 'user', 'Phạm Mạnh Hùng', 5],
    ['venue.reject', 'venue', 'Sân Pickleball Tuấn Anh', 8],
    ['owner_application.reject', 'owner_application', 'Hoàng Anh Tuấn', 8],
    ['catalog.update', 'sport', 'Thêm môn Pickleball', 12],
    ['user.role_change', 'user', 'Đỗ Minh Chủ → owner', 20],
  ];

  return entries.map(([action, entityType, label, hoursAgo], i) => ({
    id: `019273c5-7f18-7000-9000-${String(i + 1).padStart(12, '0')}`,
    actorId: admin?.id ?? null,
    actorName: admin?.fullName ?? 'Hệ thống',
    action,
    entityType,
    entityId: label,
    metadata: { label },
    createdAt: new Date(now - hoursAgo * 60 * 60 * 1000).toISOString(),
  }));
}

function seedReviews(): Review[] {
  return initialBookings.map((r) => r.review).filter((r): r is Review => r !== null);
}

function seedNotifications(): Notification[] {
  const now = Date.now();
  return [
    {
      id: '019273c5-7f16-7000-9000-000000000001',
      type: 'payment_submitted',
      title: 'Có biên lai mới cần duyệt',
      body: 'Nguyễn Thị Linh vừa gửi biên lai cho đơn tại Sân Cầu Lông Thăng Long.',
      readAt: null,
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      payload: null,
    },
    {
      id: '019273c5-7f16-7000-9000-000000000002',
      type: 'booking_confirmed',
      title: 'Đơn đặt sân đã được xác nhận',
      body: 'Pickleball Club Sala – 08:00 ngày mai.',
      readAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      payload: null,
    },
    {
      id: '019273c5-7f16-7000-9000-000000000003',
      type: 'owner_application_approved',
      title: 'Hồ sơ chủ sân đã được duyệt',
      body: 'Bạn có thể bắt đầu thêm cơ sở và sân con.',
      readAt: null,
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      payload: null,
    },
  ];
}

function seedBankAccounts(): Record<string, BankAccountInfo> {
  const ownersWithAccount = new Set<string>();
  return Object.fromEntries(
    initialVenues.flatMap((venue) => {
      if (ownersWithAccount.has(venue.ownerId)) return [];
      ownersWithAccount.add(venue.ownerId);
      return [[
        venue.id,
        { bankBin: '970436', accountNo: '0071000123456', accountName: 'NGUYEN VAN OWNER' },
      ]];
    }),
  );
}

function buildSeed(): MockDb {
  return {
    users: JSON.parse(JSON.stringify(initialUsers)) as User[],
    bookings: cloneBookings(),
    reviews: seedReviews(),
    notifications: seedNotifications(),
    ownerApplications: JSON.parse(JSON.stringify(ownerApplications)) as typeof ownerApplications,
    blackouts: JSON.parse(JSON.stringify(initialBlackouts)) as typeof initialBlackouts,
    openingHours: JSON.parse(JSON.stringify(initialOpeningHours)) as OpeningHour[],
    bankAccounts: seedBankAccounts(),
    auditLogs: seedAuditLogs(),
    // Mặc định là khách đã đăng nhập để mở app ra là thấy ngay dữ liệu có hồn
    // (hold của mình, lịch sử đặt sân). Đăng nhập vai trò khác sẽ ghi đè.
    currentUserId: '019273c5-7f12-7000-8000-000000000002',
  };
}

/**
 * Phần state được chia sẻ giữa các tab. Không lưu `users`/`reviews` tĩnh vì
 * chúng không đổi trong lúc demo; các hồ sơ Owner mới được lưu cùng bookings,
 * blackouts và openingHours để mock giữ trạng thái qua reload.
 *
 * LƯU Ý: Không chia sẻ `currentUserId` giữa các tab qua `localStorage` để cho phép
 * kiểm thử đa vai trò (Tab A là Chủ sân, Tab B là Khách đặt sân) mà không bị ghi
 * đè phiên làm việc của nhau.
 */
type PersistedState = Pick<
  MockDb,
  'bookings' | 'blackouts' | 'openingHours' | 'ownerApplications' | 'bankAccounts'
>;

function readStorage(): Partial<PersistedState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : null;
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư) — chấp nhận chạy không lưu.
    return null;
  }
}

function writeStorage(state: MockDb): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedState = {
      bookings: state.bookings,
      blackouts: state.blackouts,
      openingHours: state.openingHours,
      ownerApplications: state.ownerApplications,
      bankAccounts: state.bankAccounts,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* bỏ qua */
  }
}

function loadState(): MockDb {
  const seed = buildSeed();
  const saved = readStorage();
  const savedUserId = readSavedUserId();
  const currentUserId = savedUserId !== null ? savedUserId : seed.currentUserId;
  if (!saved) return { ...seed, currentUserId };
  const rawBlackouts = saved.blackouts ?? seed.blackouts;
  // Dọn dẹp các blackout mẫu cũ năm 2000 nếu còn lưu trong localStorage
  const cleanBlackouts = rawBlackouts.filter((b) => !b.start.startsWith('2000-'));
  return {
    ...seed,
    bookings: migrateBookingCourtIds(saved.bookings ?? seed.bookings),
    blackouts: cleanBlackouts,
    openingHours: saved.openingHours ?? seed.openingHours,
    ownerApplications: saved.ownerApplications ?? seed.ownerApplications,
    bankAccounts: saved.bankAccounts ?? seed.bankAccounts,
    currentUserId,
  };
}

export const db: MockDb = loadState();

/** Gọi sau MỌI thay đổi để các tab khác nhìn thấy. */
export function persist(): void {
  writeStorage(db);
}

/** Nạp lại từ localStorage — dùng khi tab khác vừa ghi. */
export function reloadFromStorage(): void {
  const saved = readStorage();
  if (!saved) return;
  if (saved.bookings) db.bookings = migrateBookingCourtIds(saved.bookings);
  if (saved.blackouts) db.blackouts = saved.blackouts;
  if (saved.openingHours) db.openingHours = saved.openingHours;
  if (saved.ownerApplications) db.ownerApplications = saved.ownerApplications;
  if (saved.bankAccounts) db.bankAccounts = saved.bankAccounts;
  // CHÚ Ý: Không đồng bộ db.currentUserId ở đây. Mỗi tab giữ nguyên phiên đăng nhập
  // của mình (lưu ở sessionStorage) để hỗ trợ kiểm thử đa vai trò giữa các tab.
}

/** Khôi phục toàn bộ state về ban đầu (nút "Đặt lại dữ liệu mẫu"). */
export function resetMockDb(): void {
  const seed = buildSeed();
  Object.assign(db, seed);
  saveCurrentUserId(seed.currentUserId);
  persist();
  if (typeof document !== 'undefined' && db.currentUserId) {
    const user = db.users.find((u) => u.id === db.currentUserId);
    const role = user?.role ?? 'customer';
    document.cookie = `bsc_session=${db.currentUserId}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
    document.cookie = `bsc_role=${role}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
  }
}

/**
 * Lắng nghe tab khác ghi để tab này thấy dữ liệu mới.
 * Trả về hàm huỷ đăng ký.
 */
export function subscribeToStorage(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      reloadFromStorage();
      window.dispatchEvent(new CustomEvent('bsc-mock-db-updated'));
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

// Khi chuyển tab, đồng bộ lại cookie phiên tương ứng với user của tab đó
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    if (db.currentUserId) {
      const user = db.users.find((u) => u.id === db.currentUserId);
      const role = user?.role ?? 'customer';
      document.cookie = `bsc_session=${db.currentUserId}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
      document.cookie = `bsc_role=${role}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
    }
  });
}

/** Người dùng đang đăng nhập (hoặc `null`). */
export function currentUser(): User | null {
  return db.users.find((u) => u.id === db.currentUserId) ?? null;
}

export function findUserByEmail(email: string): User | undefined {
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

/** Cập nhật trạng thái một booking và lưu lại. */
export function updateBooking(id: string, patch: Partial<Booking>): BookingRecord | undefined {
  const record = db.bookings.find((b) => b.booking.id === id);
  if (!record) return undefined;
  Object.assign(record.booking, patch);
  persist();
  return record;
}
