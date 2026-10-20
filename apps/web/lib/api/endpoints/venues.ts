import type {
  Amenity,
  Area,
  CourtSlots,
  District,
  Province,
  Sport,
  VenueDetail,
  VenueListItem,
  VenueMapPoint,
} from '@bsc/shared';

import { apiFetch, apiFetchWithMeta } from '../client';

/**
 * Endpoint module – Venues & danh mục.
 * Khớp `docs/11-api-contract.md` mục "Venues" và `mocks/handlers/venues.ts`.
 */

export type VenueSort = 'rating_desc' | 'price_asc' | 'price_desc' | 'newest';

export interface VenueListParams {
  page?: number;
  limit?: number;
  /** Từ khoá: tên, địa chỉ, tỉnh, quận. */
  q?: string;
  provinceId?: string;
  districtId?: string;
  sportIds?: string[];
  amenityIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: VenueSort;
}

/**
 * Bỏ khoá rỗng để query string gọn và không gửi `?q=` vô nghĩa.
 *
 * Mảng giữ nguyên dạng mảng — `buildUrl` lặp khoá (`?sportIds=a&sportIds=b`)
 * đúng như docs/11-api-contract.md, KHÔNG nối bằng dấu phẩy.
 */
function toQuery(
  params: VenueListParams,
): Record<string, string | number | string[] | undefined> {
  return {
    page: params.page,
    limit: params.limit,
    q: params.q?.trim() || undefined,
    provinceId: params.provinceId || undefined,
    districtId: params.districtId || undefined,
    sportIds: params.sportIds?.length ? params.sportIds : undefined,
    amenityIds: params.amenityIds?.length ? params.amenityIds : undefined,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minRating: params.minRating,
    sort: params.sort,
  };
}

export function listVenues(params: VenueListParams = {}) {
  return apiFetchWithMeta<VenueListItem[]>('/venues', { query: toQuery(params) });
}

/** `GET /venues/:idOrSlug` — nhận cả id lẫn slug. */
export function getVenue(idOrSlug: string) {
  return apiFetch<VenueDetail>(`/venues/${encodeURIComponent(idOrSlug)}`);
}

/** `GET /venues/map` — điểm ghim cho bản đồ, kèm `fromPrice` để hiện popup. */
export function getVenueMapPoints(params: Pick<VenueListParams, 'provinceId' | 'sportIds'> = {}) {
  return apiFetch<VenueMapPoint[]>('/venues/map', {
    query: {
      provinceId: params.provinceId,
      sportIds: params.sportIds?.length ? params.sportIds : undefined,
    },
  });
}

/** `GET /venues/:id/slots?date=&courtId=` — lưới giờ của một ngày. */
export function getVenueSlots(idOrSlug: string, date: string, courtId?: string) {
  return apiFetch<{ date: string; courts: CourtSlots[] }>(
    `/venues/${encodeURIComponent(idOrSlug)}/slots`,
    { query: { date, courtId } },
  );
}

/** `GET /venues/:id/reviews/summary` — phân bố số sao cho khối "Xếp hạng". */
export interface ReviewSummary {
  average: number;
  total: number;
  buckets: Array<{ star: number; count: number }>;
}

export function getVenueReviewSummary(idOrSlug: string) {
  return apiFetch<ReviewSummary>(`/venues/${encodeURIComponent(idOrSlug)}/reviews/summary`);
}

// ===== Danh mục (catalog) =====
// Các route này nằm ở gốc `/api/v1`, không lồng dưới `/catalog`.

export function listProvinces() {
  return apiFetch<Province[]>('/provinces');
}

export function listDistricts(provinceId: string) {
  return apiFetch<District[]>(`/provinces/${encodeURIComponent(provinceId)}/districts`);
}

/**
 * `GET /areas` phục vụ cả cây lẫn bộ lọc:
 * - `type: 'province'` → chỉ tỉnh (dùng cho select tỉnh).
 * - `parentId` → quận của tỉnh đó.
 * - không tham số → toàn bộ cây (màn Admin).
 */
export function listAreas(params: { type?: 'province' | 'district'; parentId?: string } = {}) {
  return apiFetch<Area[]>('/areas', { query: { type: params.type, parentId: params.parentId } });
}

export function listSports() {
  return apiFetch<Sport[]>('/sports');
}

export function listAmenities() {
  return apiFetch<Amenity[]>('/amenities');
}
