import { http } from 'msw';
import type { CourtSlots, Review, VenueListItem } from '@bsc/shared';
import { db } from '../db';
import { amenities as allAmenities, sports as allSports } from '../fixtures/catalogs';
import { buildSlots, toDateOnly } from '../fixtures/slots';
import { pricingRules, venues } from '../fixtures/venues';
import { courtNameByCourtId, venueIdByCourtId } from '../fixtures/bookings';
import { err, ok, okList, paginate, readArray, readPaging, simulateLatency } from '../utils';

/** Bỏ các trường chỉ dùng ở trang chi tiết để danh sách nhẹ hơn. */
function toListItem(v: (typeof venues)[number]): VenueListItem {
  const { description, images, courts, amenities, cancellationPolicy, ownerId, provinceId, districtId, ...rest } = v;
  return rest;
}

export const venueHandlers = [
  /** Tìm kiếm & lọc sân — docs/11-api-contract.md mục 9. */
  http.get('/api/v1/venues', async ({ request }) => {
    await simulateLatency(350);
    const url = new URL(request.url);
    const { page, limit } = readPaging(url);

    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const provinceId = url.searchParams.get('provinceId');
    const districtId = url.searchParams.get('districtId');
    const sportIds = readArray(url, 'sportIds');
    const amenityIds = readArray(url, 'amenityIds');
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    const minRating = url.searchParams.get('minRating');
    const sort = url.searchParams.get('sort') ?? 'rating_desc';

    let list = venues.filter((v) => v.status === 'approved');

    if (q) {
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q) ||
          (v.province?.name.toLowerCase().includes(q) ?? false) ||
          (v.district?.name.toLowerCase().includes(q) ?? false),
      );
    }
    if (provinceId) list = list.filter((v) => v.provinceId === provinceId);
    if (districtId) list = list.filter((v) => v.districtId === districtId);
    if (sportIds.length) list = list.filter((v) => v.sports.some((s) => sportIds.includes(s.id)));
    if (amenityIds.length) list = list.filter((v) => amenityIds.every((a) => v.amenities.some((x) => x.id === a)));
    if (minPrice) list = list.filter((v) => v.fromPrice >= Number(minPrice));
    if (maxPrice) list = list.filter((v) => v.fromPrice <= Number(maxPrice));
    if (minRating) list = list.filter((v) => v.ratingAvg >= Number(minRating));

    const sorted = [...list];
    switch (sort) {
      case 'price_asc':
        sorted.sort((a, b) => a.fromPrice - b.fromPrice);
        break;
      case 'price_desc':
        sorted.sort((a, b) => b.fromPrice - a.fromPrice);
        break;
      case 'newest':
        sorted.sort((a, b) => b.id.localeCompare(a.id));
        break;
      default:
        sorted.sort((a, b) => b.ratingAvg - a.ratingAvg);
    }

    const { data, meta } = paginate(sorted.map(toListItem), page, limit);
    return okList(data, meta);
  }),

  /** Điểm ghim bản đồ — trả TẤT CẢ, không phân trang. */
  http.get('/api/v1/venues/map', async () => {
    await simulateLatency(250);
    return ok(
      venues
        .filter((v) => v.status === 'approved')
        .map((v) => ({
          id: v.id,
          slug: v.slug,
          name: v.name,
          lat: v.lat,
          lng: v.lng,
          fromPrice: v.fromPrice,
          ratingAvg: v.ratingAvg,
        })),
    );
  }),

  /** Chi tiết theo slug (màn công khai dùng slug cho SEO). */
  http.get('/api/v1/venues/:slug', async ({ params }) => {
    await simulateLatency(300);
    const v = venues.find((x) => x.slug === params.slug || x.id === params.slug);
    if (!v) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở này');
    return ok(v);
  }),

  /**
   * Lưới slot theo ngày.
   *
   * Sinh từ giờ mở cửa + bảng giá + booking hiện có, nên slot phản ánh đúng
   * các hold/booking vừa tạo ở màn khác trong cùng phiên.
   */
  http.get('/api/v1/venues/:id/slots', async ({ params, request }) => {
    await simulateLatency(300);
    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? toDateOnly(new Date());
    const onlyCourt = url.searchParams.get('courtId');

    const venue = venues.find((v) => v.id === params.id || v.slug === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở này');

    const targetCourts = onlyCourt ? venue.courts.filter((c) => c.id === onlyCourt) : venue.courts;

    const courts: CourtSlots[] = targetCourts.map((court) => ({
      courtId: court.id,
      slots: buildSlots({
        date,
        courtId: court.id,
        venueId: venue.id,
        openingHours: db.openingHours,
        pricingRules,
        blackouts: db.blackouts,
        bookings: db.bookings.map((b) => b.booking),
        currentUserId: db.currentUserId,
      }),
    }));

    return ok({ date, courts });
  }),

  /** Đánh giá của một cơ sở. */
  http.get('/api/v1/venues/:id/reviews', async ({ params, request }) => {
    await simulateLatency(250);
    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const venue = venues.find((v) => v.id === params.id || v.slug === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở này');

    const list = db.reviews
      .filter((r) => r.venueId === venue.id)
      .map((r) => ({
        ...r,
        customer: db.users.find((u) => u.id === r.customerId)
          ? {
              id: r.customerId,
              fullName: db.users.find((u) => u.id === r.customerId)!.fullName,
              avatarUrl: null,
            }
          : undefined,
      }));

    const { data, meta } = paginate(list, page, limit);
    return okList(data, meta);
  }),

  /** Tổng hợp điểm đánh giá (số sao → số lượng) cho khối "Xếp hạng". */
  http.get('/api/v1/venues/:id/reviews/summary', async ({ params }) => {
    await simulateLatency(200);
    const venue = venues.find((v) => v.id === params.id || v.slug === params.id);
    if (!venue) return err(404, 'NOT_FOUND', 'Không tìm thấy cơ sở này');

    const list = db.reviews.filter((r) => r.venueId === venue.id);
    const buckets = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: list.filter((r) => r.rating === star).length,
    }));

    return ok({ average: venue.ratingAvg, total: venue.reviewCount, buckets });
  }),
];

/** Xuất lại để handler khác (owner) dùng chung nguồn danh mục. */
export { allAmenities, allSports, courtNameByCourtId, venueIdByCourtId };
