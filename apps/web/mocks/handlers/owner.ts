import { http } from 'msw';
import { ownerApplicationSchema, replyReviewSchema } from '@bsc/shared';
import type {
  BankAccountInfo,
  Booking,
  OpeningHour,
  OwnerApplication,
  OwnerTimelineBooking,
  Payment,
  PeakHour,
  PricingRule,
  RevenuePoint,
  Review,
  VenueImage,
} from '@bsc/shared';
import { db, currentUser, persist } from '../db';
import { courtNameByCourtId, venueIdByCourtId } from '../fixtures/bookings';
import { buildSlots, timeToMinutes, toDateOnly, weekdayOf } from '../fixtures/slots';
import { areas, sports } from '../fixtures/catalogs';
import { publish } from '../realtime';
import { err, newId, ok, okList, paginate, readPaging, simulateLatency } from '../utils';

/**
 * Handler cho kênh chủ sân.
 *
 * Mọi endpoint đều kiểm tra vai trò: chỉ `owner` (và `admin`) đi qua. Nhờ vậy
 * dựng UI xong có thể thử luôn việc chặn quyền — đăng nhập khách rồi mở
 * `/dashboard` sẽ nhận 403 chứ không phải dữ liệu.
 */
function requireOwner() {
  const user = currentUser();
  if (!user) return { error: err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập') };
  if (user.role !== 'owner' && user.role !== 'admin') {
    return { error: err(403, 'FORBIDDEN', 'Khu vực này chỉ dành cho chủ sân') };
  }
  return { user };
}

export function authorizeCustomer(user: ReturnType<typeof currentUser>) {
  if (!user) return { error: err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập') };
  if (user.role !== 'customer') {
    return { error: err(403, 'FORBIDDEN', 'Chỉ khách hàng mới có thể gửi hồ sơ chủ sân') };
  }
  return { user };
}

/** Các cơ sở thuộc chủ sân đang đăng nhập. */
function ownedVenues() {
  const user = currentUser();
  if (!user) return [];
  if (user.role === 'admin') return db.venues;
  return db.venues.filter((v) => v.ownerId === user.id);
}

function venueForCourt(courtId: string) {
  return db.venues.find((venue) => venue.courts.some((court) => court.id === courtId));
}

export function ownedVenueForCourt(courtId: string) {
  return ownedVenues().find((venue) => venue.courts.some((court) => court.id === courtId));
}

type OpeningHoursInput = Pick<OpeningHour, 'weekday' | 'openTime' | 'closeTime' | 'isClosed'>;

function isValidClockTime(time: string): boolean {
  return (
    /^\d{2}:\d{2}$/.test(time) &&
    Number(time.slice(0, 2)) < 24 &&
    Number(time.slice(3)) < 60
  );
}

export function isValidOpeningHours(hours: readonly OpeningHoursInput[]): boolean {
  return (
    hours.length === 7 &&
    new Set(hours.map((hour) => hour.weekday)).size === 7 &&
    hours.every(
      (hour) =>
        Number.isInteger(hour.weekday) &&
        hour.weekday >= 0 &&
        hour.weekday <= 6 &&
        isValidClockTime(hour.openTime) &&
        isValidClockTime(hour.closeTime) &&
        (hour.isClosed || hour.openTime < hour.closeTime),
    )
  );
}

type PricingRuleScope = Pick<
  PricingRule,
  'venueId' | 'courtId' | 'weekdays' | 'startTime' | 'endTime'
>;

export function hasOverlappingPricingRule(
  rules: readonly PricingRule[],
  candidate: PricingRuleScope,
): boolean {
  return rules.some((rule) => {
    const sameScope =
      rule.venueId === candidate.venueId && rule.courtId === candidate.courtId;
    const sharesWeekday = rule.weekdays.some((day) => candidate.weekdays.includes(day));
    const overlapsTime =
      rule.startTime < candidate.endTime && candidate.startTime < rule.endTime;
    return sameScope && sharesWeekday && overlapsTime;
  });
}

export function filterOwnerReviews<T extends Pick<Review, 'venueId' | 'ownerReply'>>(
  reviews: readonly T[],
  venueIds: ReadonlySet<string>,
  replied?: boolean,
): T[] {
  return reviews.filter(
    (review) =>
      isReviewInOwnedVenues(review, venueIds) &&
      (replied === undefined || Boolean(review.ownerReply) === replied),
  );
}

export function isReviewInOwnedVenues(
  review: Pick<Review, 'venueId'>,
  venueIds: ReadonlySet<string>,
): boolean {
  return venueIds.has(review.venueId);
}

function courtName(courtId: string) {
  return venueForCourt(courtId)?.courts.find((court) => court.id === courtId)?.name ??
    courtNameByCourtId[courtId] ??
    'Sân';
}

function venueIdForCourt(courtId: string) {
  return venueForCourt(courtId)?.id ?? venueIdByCourtId[courtId] ?? '';
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fileDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

function datesInRange(from: string, to: string): string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const first = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);
  if (
    Number.isNaN(first.getTime()) ||
    Number.isNaN(last.getTime()) ||
    first.toISOString().slice(0, 10) !== from ||
    last.toISOString().slice(0, 10) !== to ||
    first > last
  ) {
    return null;
  }

  const dates: string[] = [];
  for (const cursor = first; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
    if (dates.length > 366) return null;
  }
  return dates;
}

function courtCapacityForDate(courtId: string, date: string): number {
  const venueId = venueIdForCourt(courtId);
  if (!venueId) return 0;
  const weekday = weekdayOf(date);
  const hours = db.openingHours.filter(
    (entry) =>
      entry.venueId === venueId &&
      entry.weekday === weekday &&
      (entry.courtId === null || entry.courtId === courtId),
  );
  const window = hours.find((entry) => entry.courtId === courtId) ?? hours.find((entry) => !entry.courtId);
  if (!window || window.isClosed) return 0;

  let count = 0;
  for (
    let minutes = timeToMinutes(window.openTime);
    minutes + 30 <= timeToMinutes(window.closeTime);
    minutes += 30
  ) {
    const start = new Date(`${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00+07:00`).getTime();
    const end = start + 30 * 60 * 1000;
    const blocked = db.blackouts.some(
      (blackout) =>
        blackout.courtId === courtId &&
        start < new Date(blackout.end).getTime() &&
        end > new Date(blackout.start).getTime(),
    );
    if (!blocked) count += 1;
  }
  return count;
}

export const ownerHandlers = [
  // ── Cơ sở & sân con ──────────────────────────────────────────────────────
  http.get('/api/v1/owner/venues', async () => {
    await simulateLatency(300);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(ownedVenues());
  }),

  http.post('/api/v1/venues', async ({ request }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const body = (await request.json()) as {
      name?: string;
      address?: string;
      provinceId?: string;
      districtId?: string;
      sportIds?: string[];
      description?: string;
      lat?: number;
      lng?: number;
    };
    const province = areas.find((area) => area.id === body.provinceId && area.type === 'province');
    const district = areas.find(
      (area) => area.id === body.districtId && area.type === 'district' && area.parentId === province?.id,
    );
    const selectedSports = sports.filter((sport) => body.sportIds?.includes(sport.id));
    if (
      !body.name?.trim() ||
      !body.address?.trim() ||
      !province ||
      !district ||
      typeof body.lat !== 'number' ||
      typeof body.lng !== 'number' ||
      !Number.isFinite(body.lat) ||
      !Number.isFinite(body.lng) ||
      body.lat < -90 ||
      body.lat > 90 ||
      body.lng < -180 ||
      body.lng > 180 ||
      (body.lat === 0 && body.lng === 0) ||
      selectedSports.length === 0 ||
      selectedSports.length !== body.sportIds?.length
    ) {
      return err(422, 'VALIDATION_ERROR', 'Vui lòng kiểm tra thông tin, vị trí ghim và môn thể thao của cơ sở');
    }

    const id = newId();
    const slugBase = slugify(body.name);
    const venue = {
      id,
      ownerId: guard.user!.id,
      name: body.name.trim(),
      slug: `${slugBase}-${id.slice(-6)}`,
      description: body.description?.trim() || null,
      address: body.address.trim(),
      provinceId: province.id,
      districtId: district.id,
      province: { id: province.id, name: province.name, slug: province.slug },
      district: { id: district.id, name: district.name, slug: district.slug, provinceId: province.id },
      lat: body.lat,
      lng: body.lng,
      status: 'pending' as const,
      coverUrl: null,
      ratingAvg: 0,
      reviewCount: 0,
      fromPrice: 0,
      images: [],
      amenities: [],
      courts: [],
      sports: selectedSports,
      cancellationPolicy: null,
    };
    db.venues.push(venue);
    persist();
    return ok(venue, 201);
  }),

  http.patch('/api/v1/venues/:id', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venue = ownedVenues().find((item) => item.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');
    const body = (await request.json()) as {
      name?: string;
      address?: string;
      provinceId?: string | null;
      districtId?: string | null;
      sportIds?: string[];
      description?: string | null;
      lat?: number;
      lng?: number;
    };
    if (body.name !== undefined && body.name.trim().length < 2) {
      return err(422, 'VALIDATION_ERROR', 'Tên cơ sở phải có ít nhất 2 ký tự');
    }
    if (body.address !== undefined && body.address.trim().length < 5) {
      return err(422, 'VALIDATION_ERROR', 'Địa chỉ phải có ít nhất 5 ký tự');
    }
    if (
      body.lat !== undefined ||
      body.lng !== undefined
    ) {
      if (
        typeof body.lat !== 'number' ||
        typeof body.lng !== 'number' ||
        !Number.isFinite(body.lat) ||
        !Number.isFinite(body.lng) ||
        body.lat < -90 ||
        body.lat > 90 ||
        body.lng < -180 ||
        body.lng > 180 ||
        (body.lat === 0 && body.lng === 0)
      ) {
        return err(422, 'VALIDATION_ERROR', 'Vị trí ghim trên bản đồ không hợp lệ');
      }
    }

    const provinceId = body.provinceId ?? venue.provinceId;
    const province = areas.find((area) => area.id === provinceId && area.type === 'province');
    const districtId = body.districtId ?? venue.districtId;
    const district = areas.find(
      (area) =>
        area.id === districtId &&
        area.type === 'district' &&
        area.parentId === province?.id,
    );
    if (!province || !district) {
      return err(422, 'VALIDATION_ERROR', 'Quận/huyện không thuộc tỉnh/thành phố đã chọn');
    }

    const selectedSports =
      body.sportIds === undefined
        ? venue.sports
        : sports.filter((sport) => body.sportIds?.includes(sport.id));
    if (
      selectedSports.length === 0 ||
      selectedSports.length !== (body.sportIds?.length ?? selectedSports.length)
    ) {
      return err(422, 'VALIDATION_ERROR', 'Vui lòng chọn ít nhất một môn thể thao hợp lệ');
    }
    if (
      venue.courts.some(
        (court) => court.sportId !== null && !selectedSports.some((sport) => sport.id === court.sportId),
      )
    ) {
      return err(409, 'RESOURCE_IN_USE', 'Không thể bỏ môn thể thao đang được sân con sử dụng');
    }

    if (body.lat !== undefined && body.lng !== undefined) {
      venue.lat = body.lat;
      venue.lng = body.lng;
    }
    if (body.name !== undefined) venue.name = body.name.trim();
    if (body.address !== undefined) venue.address = body.address.trim();
    if (body.description !== undefined) venue.description = body.description?.trim() || null;
    venue.provinceId = province.id;
    venue.province = { id: province.id, name: province.name, slug: province.slug };
    venue.districtId = district.id;
    venue.district = {
      id: district.id,
      name: district.name,
      slug: district.slug,
      provinceId: district.parentId!,
    };
    if (body.sportIds !== undefined) {
      venue.sports = selectedSports;
    }
    persist();
    return ok(venue);
  }),

  http.post('/api/v1/venues/:id/images', async ({ params, request }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venue = ownedVenues().find((item) => item.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return err(422, 'VALIDATION_ERROR', 'Vui lòng chọn ảnh cơ sở');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return err(400, 'UNSUPPORTED_FILE_TYPE', 'Chỉ nhận ảnh JPG, PNG hoặc WebP');
    }
    if (file.size > 5 * 1024 * 1024) {
      return err(413, 'FILE_TOO_LARGE', 'Ảnh cơ sở tối đa 5 MB');
    }

    const image: VenueImage = {
      id: newId(),
      url: await fileDataUrl(file),
      sortOrder: 0,
    };
    venue.images = [
      image,
      ...venue.images.map((existing, index) => ({ ...existing, sortOrder: index + 1 })),
    ];
    venue.coverUrl = image.url;
    persist();
    return ok({ id: image.id, url: image.url }, 201);
  }),

  http.post('/api/v1/venues/:id/courts', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venue = ownedVenues().find((item) => item.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');
    const body = (await request.json()) as { name?: string; sportId?: string; description?: string };
    const sport = venue.sports.find((item) => item.id === body.sportId);
    if (!body.name?.trim() || !sport) {
      return err(422, 'VALIDATION_ERROR', 'Vui lòng nhập tên sân và chọn môn thể thao của cơ sở');
    }
    const court = {
      id: newId(),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      sportId: sport.id,
      status: 'active' as const,
    };
    venue.courts.push(court);
    persist();
    return ok(court, 201);
  }),

  http.delete('/api/v1/courts/:id', async ({ params }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const venue = ownedVenueForCourt(params.id as string);
    const court = venue?.courts.find((item) => item.id === params.id);
    if (!venue || !court) return err(404, 'NOT_FOUND', 'Không tìm thấy sân');

    // Không cho xoá sân còn booking đang hoạt động — docs/11 (409 RESOURCE_IN_USE).
    const busy = db.bookings.some(
      (b) => b.booking.courtId === params.id && ['held', 'pending_payment', 'confirmed'].includes(b.booking.status),
    );
    if (busy) {
      return err(409, 'RESOURCE_IN_USE', 'Sân còn đơn đang hoạt động, không thể xoá');
    }
    venue.courts = venue.courts.filter((item) => item.id !== params.id);
    persist();
    return ok({ success: true });
  }),

  // ── Giờ mở cửa, bảng giá, khoá sân ───────────────────────────────────────
  http.get('/api/v1/owner/venues/:id/opening-hours', async ({ params }) => {
    await simulateLatency(250);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venue = ownedVenues().find((item) => item.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');
    return ok(db.openingHours.filter((o) => o.venueId === venue.id));
  }),

  http.put('/api/v1/owner/venues/:id/opening-hours', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venueId = params.id as string;
    if (!ownedVenues().some((venue) => venue.id === venueId)) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');
    }
    const body = (await request.json()) as
      | {
          hours?: Array<
            Omit<OpeningHour, 'id' | 'venueId'> & {
              id?: string;
              venueId?: string;
            }
          >;
        }
      | Array<
          Omit<OpeningHour, 'id' | 'venueId'> & {
            id?: string;
            venueId?: string;
          }
        >;
    const incoming = Array.isArray(body) ? body : (body.hours ?? []);

    if (!isValidOpeningHours(incoming)) {
      return err(422, 'VALIDATION_ERROR', 'Cần cấu hình hợp lệ đủ 7 ngày trong tuần');
    }

    db.openingHours = db.openingHours.filter(
      (hour) => hour.venueId !== venueId || hour.courtId !== null,
    );

    const updated: OpeningHour[] = incoming.map((h, i) => ({
      id: h.id ?? `${venueId.slice(0, 22)}oh${h.weekday ?? i}`,
      courtId: h.courtId ?? null,
      venueId,
      weekday: h.weekday,
      openTime: h.openTime,
      closeTime: h.closeTime,
      isClosed: Boolean(h.isClosed),
    }));

    db.openingHours.push(...updated);
    persist();
    return ok(updated);
  }),

  http.get('/api/v1/owner/venues/:id/pricing-rules', async ({ params }) => {
    await simulateLatency(250);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venue = ownedVenues().find((item) => item.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');
    return ok(db.pricingRules.filter((rule) => rule.venueId === venue.id));
  }),

  http.post('/api/v1/owner/venues/:id/pricing-rules', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venue = ownedVenues().find((item) => item.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');
    const body = (await request.json()) as Partial<PricingRule>;
    const weekdays = Array.isArray(body.weekdays) ? body.weekdays : [];
    const validTime = (time: string | undefined) =>
      typeof time === 'string' && isValidClockTime(time);
    if (
      typeof body.label !== 'string' ||
      body.label.trim().length === 0 ||
      body.label.trim().length > 100 ||
      weekdays.length === 0 ||
      weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(weekdays).size !== weekdays.length ||
      !validTime(body.startTime) ||
      !validTime(body.endTime) ||
      body.startTime! >= body.endTime! ||
      !Number.isInteger(body.pricePerSlot) ||
      body.pricePerSlot! < 0 ||
      (body.courtId !== null && !venue.courts.some((court) => court.id === body.courtId))
    ) {
      return err(422, 'VALIDATION_ERROR', 'Vui lòng kiểm tra thông tin khung giá');
    }

    const conflicts = hasOverlappingPricingRule(db.pricingRules, {
      venueId: venue.id,
      courtId: body.courtId ?? null,
      weekdays,
      startTime: body.startTime!,
      endTime: body.endTime!,
    });
    if (conflicts) {
      return err(409, 'ALREADY_EXISTS', 'Khung giờ và ngày đã trùng với một quy tắc giá khác');
    }

    const rule: PricingRule = {
      id: newId(),
      venueId: venue.id,
      courtId: body.courtId ?? null,
      label: body.label.trim(),
      weekdays,
      startTime: body.startTime!,
      endTime: body.endTime!,
      pricePerSlot: body.pricePerSlot!,
    };
    db.pricingRules.push(rule);
    const venueRules = db.pricingRules.filter((item) => item.venueId === venue.id);
    if (venueRules.length > 0) {
      venue.fromPrice = Math.min(...venueRules.map((item) => item.pricePerSlot));
    }
    persist();
    return ok(rule, 201);
  }),

  http.delete('/api/v1/owner/pricing-rules/:id', async ({ params }) => {
    await simulateLatency(300);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const rule = db.pricingRules.find((item) => item.id === params.id);
    if (!rule || !ownedVenues().some((venue) => venue.id === rule.venueId)) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy khung giá');
    }
    db.pricingRules = db.pricingRules.filter((item) => item.id !== rule.id);
    const venue = db.venues.find((item) => item.id === rule.venueId);
    const remainingRules = db.pricingRules.filter((item) => item.venueId === rule.venueId);
    if (venue && remainingRules.length > 0) {
      venue.fromPrice = Math.min(...remainingRules.map((item) => item.pricePerSlot));
    }
    persist();
    return ok({ success: true });
  }),

  http.post('/api/v1/courts/:id/blackouts', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const body = (await request.json()) as {
      start: string;
      end: string;
      reason?: string;
    };
    const created = {
      id: newId(),
      courtId: params.id as string,
      start: body.start,
      end: body.end,
      reason: body.reason ?? null,
      createdAt: new Date().toISOString(),
    };
    // Ghi vào state sống để lưới slot lập tức hiện ô `blocked`.
    db.blackouts.push(created);
    persist();
    return ok(created, 201);
  }),

  http.get('/api/v1/courts/:id/blackouts', async ({ params }) => {
    await simulateLatency(250);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(db.blackouts.filter((b) => b.courtId === params.id));
  }),

  http.delete('/api/v1/courts/:id/blackouts/:blackoutId', async ({ params }) => {
    await simulateLatency(300);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const courtId = params.id as string;
    const blackoutId = params.blackoutId as string;
    const index = db.blackouts.findIndex((b) => b.id === blackoutId && (b.courtId === courtId || !courtId));
    if (index === -1) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy khoảng khoá sân');
    }
    const removed = db.blackouts.splice(index, 1)[0];
    persist();
    return ok({ success: true, blackout: removed });
  }),

  // ── Tài khoản ngân hàng & chính sách huỷ ─────────────────────────────────
  http.get('/api/v1/owner/venues/:id/payment-account', async ({ params }) => {
    await simulateLatency(250);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venue = ownedVenues().find((item) => item.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');
    return ok(db.bankAccounts[venue.id] ?? null);
  }),

  http.put('/api/v1/owner/venues/:id/payment-account', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    const venue = ownedVenues().find((item) => item.id === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở');

    const body = (await request.json()) as Partial<BankAccountInfo>;
    if (
      typeof body.bankBin !== 'string' ||
      !/^\d{6}$/.test(body.bankBin) ||
      typeof body.accountNo !== 'string' ||
      !/^\d{6,20}$/.test(body.accountNo) ||
      typeof body.accountName !== 'string' ||
      body.accountName.trim().length < 2
    ) {
      return err(422, 'VALIDATION_ERROR', 'Thông tin tài khoản ngân hàng chưa hợp lệ');
    }
    const account = { ...body, accountName: body.accountName.trim() } as BankAccountInfo;
    db.bankAccounts[venue.id] = account;
    persist();
    return ok(account);
  }),

  http.put('/api/v1/owner/cancellation-policy', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;
    return ok(await request.json());
  }),

  // ── Duyệt thanh toán ─────────────────────────────────────────────────────
  /**
   * Danh sách đơn cần duyệt. Đây là dữ liệu nuôi màn O-02 và cũng là thứ đổi
   * trạng thái khi bấm Duyệt/Từ chối.
   */
  http.get('/api/v1/owner/payments', async ({ request }) => {
    await simulateLatency(350);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const status = url.searchParams.get('status');

    const myVenueIds = new Set(ownedVenues().map((v) => v.id));

    let list = db.bookings
      .filter((b) => myVenueIds.has(venueIdForCourt(b.booking.courtId)))
      .filter((b) => b.payment !== null);

    if (status) list = list.filter((b) => b.payment!.status === status);

    list = [...list].sort((a, b) =>
      (b.payment?.proofUploadedAt ?? b.booking.createdAt).localeCompare(
        a.payment?.proofUploadedAt ?? a.booking.createdAt,
      ),
    );

    const shaped = list.map((r) => ({
      id: r.payment!.id,
      bookingId: r.booking.id,
      amount: r.payment!.amount,
      provider: r.payment!.provider,
      transferCode: r.payment!.transferCode,
      proofUrl: r.payment!.proofUrl,
      proofUploadedAt: r.payment!.proofUploadedAt,
      status: r.payment!.status,
      rejectReason: r.payment!.rejectReason ?? null,
      booking: {
        id: r.booking.id,
        during: r.booking.during,
        status: r.booking.status,
        totalPrice: r.booking.totalPrice,
        courtName: courtName(r.booking.courtId),
        venueName: venueForCourt(r.booking.courtId)?.name ?? '',
        customerName:
          db.users.find((u) => u.id === r.booking.customerId)?.fullName ?? r.booking.guestName ?? 'Khách vãng lai',
        customerPhone: db.users.find((u) => u.id === r.booking.customerId)?.phone ?? r.booking.guestPhone ?? null,
      },
    }));

    const { data, meta } = paginate(shaped, page, limit);
    return okList(data, meta);
  }),

  /** Duyệt thanh toán → booking `confirmed`. */
  http.patch('/api/v1/owner/payments/:id/approve', async ({ params }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const record = db.bookings.find((b) => b.payment?.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy giao dịch');

    record.payment!.status = 'completed';
    record.payment!.paidAt = new Date().toISOString();
    record.payment!.reviewedBy = guard.user!.id;
    record.booking.status = 'confirmed';
    persist();
    publish({
      type: 'booking_confirmed',
      payload: { bookingId: record.booking.id },
    });

    return ok({ booking: record.booking, payment: record.payment });
  }),

  /** Từ chối thanh toán → huỷ đơn và trả slot về trống. */
  http.patch('/api/v1/owner/payments/:id/reject', async ({ params, request }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const record = db.bookings.find((b) => b.payment?.id === params.id);
    if (!record) return err(404, 'NOT_FOUND', 'Không tìm thấy giao dịch');

    const body = (await request.json()) as { reason?: string };

    record.payment!.status = 'rejected';
    record.payment!.reviewedBy = guard.user!.id;
    record.payment!.rejectReason = body.reason ?? 'Biên lai không hợp lệ';
    record.booking.status = 'cancelled';
    record.booking.cancelledAt = new Date().toISOString();
    record.booking.cancelReason = body.reason ?? 'Biên lai không hợp lệ';
    persist();
    publish({
      type: 'booking_cancelled',
      payload: { bookingId: record.booking.id },
    });

    return ok({ booking: record.booking, payment: record.payment });
  }),

  // ── Đơn đặt sân & timeline ───────────────────────────────────────────────
  http.get('/api/v1/owner/bookings', async ({ request }) => {
    await simulateLatency(350);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const status = url.searchParams.get('status');
    const venueId = url.searchParams.get('venueId');
    const courtId = url.searchParams.get('courtId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const query = url.searchParams.get('q')?.trim().toLocaleLowerCase('vi-VN');
    const myVenueIds = new Set(ownedVenues().filter((v) => !venueId || v.id === venueId).map((v) => v.id));

    let list = db.bookings.filter((b) => myVenueIds.has(venueIdForCourt(b.booking.courtId)));
    if (courtId) list = list.filter((b) => b.booking.courtId === courtId);
    if (from) list = list.filter((b) => b.booking.during.start.slice(0, 10) >= from);
    if (to) list = list.filter((b) => b.booking.during.start.slice(0, 10) <= to);
    if (status) list = list.filter((b) => b.booking.status === status);
    list = [...list].sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt));

    const shaped = list.map((r) => ({
      ...r.booking,
      courtName: courtName(r.booking.courtId),
      customerName:
        db.users.find((u) => u.id === r.booking.customerId)?.fullName ?? r.booking.guestName ?? 'Khách vãng lai',
      customerPhone: db.users.find((u) => u.id === r.booking.customerId)?.phone ?? r.booking.guestPhone ?? null,
      paymentStatus: r.payment?.status ?? null,
    }));

    const filtered = query
      ? shaped.filter((booking) =>
          [
            booking.id,
            booking.customerName,
            booking.customerPhone,
            booking.guestName,
            booking.guestPhone,
            booking.courtName,
          ].some((value) => value?.toLocaleLowerCase('vi-VN').includes(query)),
        )
      : shaped;

    const { data, meta } = paginate(filtered, page, limit);
    return okList(data, meta);
  }),

  /**
   * Timeline theo ngày — dữ liệu cho `OwnerTimeline` (OWN-06).
   *
   * Phạm vi một cơ sở: trả sân, đơn, khoá sân và giờ mở cửa của cơ sở đó
   * trong một response, để lưới chỉ cần một lượt gọi.
   */
  http.get('/api/v1/owner/timeline', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? toDateOnly(new Date());
    const venueId = url.searchParams.get('venueId');

    if (!venueId) return err(400, 'VALIDATION_ERROR', 'Thiếu tham số venueId.');

    const venue = ownedVenues().find((v) => v.id === venueId);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở.');

    const courtIds = new Set(venue.courts.map((c) => c.id));

    const items: OwnerTimelineBooking[] = db.bookings
      .filter((b) => courtIds.has(b.booking.courtId))
      .filter((b) => b.booking.during.start.slice(0, 10) === date)
      .filter((b) => !['cancelled', 'expired'].includes(b.booking.status))
      .map((b) => ({
        id: b.booking.id,
        courtId: b.booking.courtId,
        during: b.booking.during,
        status: b.booking.status,
        source: b.booking.source,
        guestName: b.booking.guestName,
        customerName: db.users.find((u) => u.id === b.booking.customerId)?.fullName ?? b.booking.guestName ?? null,
        totalPrice: b.booking.totalPrice,
      }));

    return ok({
      date,
      venueId,
      courts: venue.courts,
      bookings: items,
      blackouts: db.blackouts.filter((b) => {
        if (!courtIds.has(b.courtId)) return false;
        const dayStart = new Date(`${date}T00:00:00+07:00`).getTime();
        const dayEnd = new Date(`${date}T23:59:59+07:00`).getTime();
        const bStart = new Date(b.start).getTime();
        const bEnd = new Date(b.end).getTime();
        return bStart <= dayEnd && bEnd >= dayStart;
      }),
      // Trả cả 7 thứ: `courtWindow()` tự lọc theo thứ của ngày đang xem.
      openingHours: db.openingHours.filter((o) => o.venueId === venueId),
    });
  }),

  /** Đặt sân tại quầy (chủ sân tạo thay khách). */
  http.post('/api/v1/owner/bookings/manual', async ({ request }) => {
    await simulateLatency(500);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const body = (await request.json()) as {
      courtId: string;
      slots: Array<{ start: string; end: string }>;
      guestName: string;
      guestPhone: string;
      note?: string;
    };

    const date = body.slots[0]?.start.slice(0, 10);
    if (!date) return err(422, 'VALIDATION_ERROR', 'Thiếu thông tin khung giờ');

    const venueId = venueIdForCourt(body.courtId);
    if (!ownedVenues().some((venue) => venue.id === venueId)) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy sân thuộc cơ sở của bạn');
    }
    const grid = buildSlots({
      date,
      courtId: body.courtId,
      venueId,
      openingHours: db.openingHours,
      pricingRules: db.pricingRules,
      blackouts: db.blackouts,
      bookings: db.bookings.map((b) => b.booking),
      currentUserId: db.currentUserId,
    });

    const picked = grid.filter((s) => body.slots.some((w) => s.start >= w.start && s.end <= w.end));
    if (picked.some((s) => s.status !== 'available')) {
      return err(409, 'SLOT_TAKEN', 'Khung giờ này đã có người đặt');
    }

    const booking: Booking = {
      id: newId(),
      courtId: body.courtId,
      customerId: null,
      source: 'manual',
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      during: {
        start: body.slots[0]!.start,
        end: body.slots[body.slots.length - 1]!.end,
      },
      status: 'confirmed',
      totalPrice: picked.reduce((s, x) => s + x.price, 0),
      depositAmount: 0,
      note: body.note ?? null,
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date().toISOString(),
    };

    const payment: Payment = {
      id: newId(),
      amount: booking.totalPrice,
      provider: 'cash',
      transferCode: null,
      proofUrl: null,
      proofUploadedAt: null,
      status: 'completed',
      paidAt: new Date().toISOString(),
      reviewedBy: guard.user!.id,
      rejectReason: null,
      refundAmount: null,
    };

    db.bookings.unshift({ booking, payment, review: null });
    persist();
    return ok(booking, 201);
  }),

  // ── Báo cáo doanh thu ────────────────────────────────────────────────────
  http.get('/api/v1/owner/reports/revenue', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const dates = datesInRange(url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? '');
    if (!dates) return err(400, 'VALIDATION_ERROR', 'Khoảng ngày báo cáo chưa hợp lệ');
    const groupBy = url.searchParams.get('groupBy') ?? 'day';
    if (!['day', 'week', 'month'].includes(groupBy)) {
      return err(400, 'VALIDATION_ERROR', 'Kiểu nhóm báo cáo chưa hợp lệ');
    }
    const venueId = url.searchParams.get('venueId');
    const courtId = url.searchParams.get('courtId');
    const myVenueIds = new Set(
      ownedVenues()
        .filter((venue) => !venueId || venue.id === venueId)
        .map((venue) => venue.id),
    );

    const revenueBookings = db.bookings.filter(
      (b) =>
        myVenueIds.has(venueIdForCourt(b.booking.courtId)) &&
        (!courtId || b.booking.courtId === courtId) &&
        b.booking.during.start.slice(0, 10) >= dates[0]! &&
        b.booking.during.start.slice(0, 10) <= dates[dates.length - 1]! &&
        ['confirmed', 'completed'].includes(b.booking.status),
    );

    const bucketFor = (date: string) => {
      if (groupBy === 'month') return `${date.slice(0, 7)}-01`;
      if (groupBy === 'week') {
        const monday = new Date(`${date}T00:00:00.000Z`);
        monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
        return monday.toISOString().slice(0, 10);
      }
      return date;
    };
    const bucketValues = new Map<string, { revenue: number; bookings: number }>();
    for (const date of dates) {
      const key = bucketFor(date);
      if (!bucketValues.has(key)) bucketValues.set(key, { revenue: 0, bookings: 0 });
    }
    for (const record of revenueBookings) {
      const date = record.booking.during.start.slice(0, 10);
      const key = bucketFor(date);
      const bucket = bucketValues.get(key);
      if (bucket) {
        bucket.revenue += record.booking.totalPrice;
        bucket.bookings += 1;
      }
    }
    const series: RevenuePoint[] = [...bucketValues.entries()].map(([date, bucket]) => ({
      date,
      ...bucket,
    }));

    const totalRevenue = series.reduce((s, p) => s + p.revenue, 0);
    const totalBookings = series.reduce((s, p) => s + p.bookings, 0);

    return ok({
      summary: {
        totalRevenue,
        totalBookings,
        from: dates[0]!,
        to: dates[dates.length - 1]!,
      },
      series,
    });
  }),

  http.get('/api/v1/owner/reports/occupancy', async ({ request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const dates = datesInRange(url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? '');
    if (!dates) return err(400, 'VALIDATION_ERROR', 'Khoảng ngày báo cáo chưa hợp lệ');
    const venueId = url.searchParams.get('venueId');
    const courtId = url.searchParams.get('courtId');
    const selectedVenues = ownedVenues().filter((venue) => !venueId || venue.id === venueId);
    const courtIds = new Set(
      selectedVenues.flatMap((venue) =>
        venue.courts.filter((court) => !courtId || court.id === courtId).map((court) => court.id),
      ),
    );

    const ownerBookings = db.bookings.filter(
      (record) =>
        courtIds.has(record.booking.courtId) &&
        record.booking.during.start.slice(0, 10) >= dates[0]! &&
        record.booking.during.start.slice(0, 10) <= dates[dates.length - 1]! &&
        ['confirmed', 'completed'].includes(record.booking.status),
    );
    const series = dates.map((date) => {
      const dayBookings = ownerBookings.filter((record) => record.booking.during.start.slice(0, 10) === date);
      const bookedSlots = dayBookings
        .reduce((total, record) => {
          const duration =
            new Date(record.booking.during.end).getTime() -
            new Date(record.booking.during.start).getTime();
          return total + Math.max(0, Math.round(duration / (30 * 60 * 1000)));
        }, 0);
      const capacity = [...courtIds].reduce((total, courtId) => total + courtCapacityForDate(courtId, date), 0);
      const availableSlots = Math.max(0, capacity - bookedSlots);
      return {
        date,
        bookedSlots,
        availableSlots,
        occupancyRate: capacity ? Math.min(1, bookedSlots / capacity) : 0,
      };
    });
    const bookedSlots = series.reduce((total, point) => total + point.bookedSlots, 0);
    const availableSlots = series.reduce((total, point) => total + point.availableSlots, 0);
    const capacity = bookedSlots + availableSlots;
    const peakCounts = new Map<number, number>();
    for (const record of ownerBookings) {
      const startMinutes = timeToMinutes(record.booking.during.start.slice(11, 16));
      const duration =
        new Date(record.booking.during.end).getTime() -
        new Date(record.booking.during.start).getTime();
      const slots = Math.max(0, Math.round(duration / (30 * 60 * 1000)));
      for (let index = 0; index < slots; index += 1) {
        const slotStart = (startMinutes + index * 30) % (24 * 60);
        peakCounts.set(slotStart, (peakCounts.get(slotStart) ?? 0) + 1);
      }
    }
    const peakHours: PeakHour[] = [...peakCounts.entries()]
      .sort(([timeA, countA], [timeB, countB]) => countB - countA || timeA - timeB)
      .slice(0, 3)
      .map(([start, booked]) => {
        const end = (start + 30) % (24 * 60);
        const toTime = (minutes: number) =>
          `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        return { startTime: toTime(start), endTime: toTime(end), bookedSlots: booked };
      });

    return ok({
      summary: {
        occupancyRate: capacity ? bookedSlots / capacity : 0,
        bookedSlots,
        availableSlots,
        from: dates[0]!,
        to: dates[dates.length - 1]!,
        peakHours,
      },
      series,
    });
  }),

  // ── Đánh giá ─────────────────────────────────────────────────────────────
  http.get('/api/v1/owner/reviews', async ({ request }) => {
    await simulateLatency(300);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const venueIds = new Set(
      ownedVenues()
        .filter((venue) => !url.searchParams.get('venueId') || venue.id === url.searchParams.get('venueId'))
        .map((venue) => venue.id),
    );
    const repliedParam = url.searchParams.get('replied');
    const replied = repliedParam === 'true' ? true : repliedParam === 'false' ? false : undefined;

    const list = filterOwnerReviews(db.reviews, venueIds, replied)
      .map((r) => ({
        ...r,
        venueName: db.venues.find((v) => v.id === r.venueId)?.name ?? '',
        customerName: db.users.find((u) => u.id === r.customerId)?.fullName ?? 'Khách',
        courtName: courtName(
          db.bookings.find((record) => record.review?.id === r.id)?.booking.courtId ?? '',
        ),
      }));

    const { data, meta } = paginate(list, page, limit);
    return okList(data, meta);
  }),

  http.patch('/api/v1/owner/reviews/:id/reply', async ({ params, request }) => {
    await simulateLatency(400);
    const guard = requireOwner();
    if (guard.error) return guard.error;

    const review = db.reviews.find((r) => r.id === params.id);
    const venueIds = new Set(ownedVenues().map((venue) => venue.id));
    if (!review || !isReviewInOwnedVenues(review, venueIds)) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy đánh giá');
    }

    const parsed = replyReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return err(422, 'VALIDATION_ERROR', 'Nội dung phản hồi chưa hợp lệ');
    }
    review.ownerReply = parsed.data.ownerReply.trim();
    review.ownerRepliedAt = new Date().toISOString();

    // Đồng bộ vào record booking để màn chi tiết cũng thấy phản hồi.
    const record = db.bookings.find((b) => b.review?.id === params.id);
    if (record?.review) {
      record.review.ownerReply = review.ownerReply;
      record.review.ownerRepliedAt = review.ownerRepliedAt;
    }
    persist();

    return ok(review);
  }),

  // ── Đăng ký làm chủ sân (OWN-01 / BSC-062) ───────────────────────────────
  http.post('/api/v1/owner/apply', async ({ request }) => {
    await simulateLatency(600);
    const guard = authorizeCustomer(currentUser());
    if (guard.error) return guard.error;
    const { user } = guard;
    const body = (await request.json()) as Record<string, unknown>;

    // Kiểm tra hồ sơ pending hiện có
    const pendingApp = db.ownerApplications.find((a) => a.user.id === user.id && a.status === 'pending');
    if (pendingApp) {
      return err(409, 'ALREADY_PENDING', 'Bạn đã có một hồ sơ đang chờ xét duyệt');
    }

    const newApp: OwnerApplication = {
      id: newId(),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: (body.phone as string) || user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      businessName: String(body.businessName || 'Cơ sở kinh doanh'),
      taxCode: body.taxCode ? String(body.taxCode) : null,
      idCardUrl: body.idCardUrl ? String(body.idCardUrl) : 'https://picsum.photos/seed/cccd-apply/800/500',
      status: 'pending',
      rejectReason: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };

    db.ownerApplications.unshift(newApp);
    db.auditLogs.unshift({
      id: newId(),
      actorId: user.id,
      actorName: user.fullName,
      action: 'owner_application_created',
      entityType: 'owner_application',
      entityId: newApp.id,
      metadata: { businessName: newApp.businessName },
      createdAt: new Date().toISOString(),
    });
    persist();

    return ok(newApp, 201);
  }),

  http.post('/api/v1/owner-applications', async ({ request }) => {
    await simulateLatency(600);
    const guard = authorizeCustomer(currentUser());
    if (guard.error) return guard.error;
    const { user } = guard;
    const parsed = ownerApplicationSchema.safeParse(await request.json());
    if (!parsed.success) {
      const details = Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'form'), [issue.message]]),
      );
      return err(422, 'VALIDATION_ERROR', 'Thông tin hồ sơ chưa hợp lệ', details);
    }
    const body = parsed.data;

    const pendingApp = db.ownerApplications.find((a) => a.user.id === user.id && a.status === 'pending');
    if (pendingApp) {
      return err(409, 'ALREADY_PENDING', 'Bạn đã có một hồ sơ đang chờ xét duyệt');
    }

    const newApp: OwnerApplication = {
      id: newId(),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: body.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      businessName: body.businessName,
      phone: body.phone,
      address: body.address,
      taxCode: body.taxCode ?? null,
      idCardUrl: body.idCardUrl ?? null,
      bankBin: body.bankBin,
      bankName: body.bankName,
      accountNo: body.accountNo,
      accountName: body.accountName,
      note: body.note ?? null,
      status: 'pending',
      rejectReason: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };

    db.ownerApplications.unshift(newApp);
    db.auditLogs.unshift({
      id: newId(),
      actorId: user.id,
      actorName: user.fullName,
      action: 'owner_application_created',
      entityType: 'owner_application',
      entityId: newApp.id,
      metadata: { businessName: newApp.businessName },
      createdAt: new Date().toISOString(),
    });
    persist();

    return ok(newApp, 201);
  }),

  http.get('/api/v1/owner/apply', async () => {
    await simulateLatency(250);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const app = db.ownerApplications.find((a) => a.user.id === user.id);
    return ok(app ?? null);
  }),

  http.get('/api/v1/owner-applications/me', async () => {
    await simulateLatency(250);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const app = db.ownerApplications.find((a) => a.user.id === user.id);
    return ok(app ?? null);
  }),
];
