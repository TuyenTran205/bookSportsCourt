import type {
  Blackout,
  CancellationPolicy,
  Court,
  OpeningHour,
  PricingRule,
  VenueDetail,
} from '@bsc/shared';
import { amenities, districts, provinces, sports } from './catalogs';

/**
 * Cơ sở + sân con + giờ mở cửa + bảng giá + khoá sân.
 *
 * Dựng theo đúng shape `VenueDetail` của docs/11-api-contract.md mục 8.2.
 * Ảnh dùng picsum.photos (đã khai báo trong next.config.mjs) để không phải
 * commit ảnh nặng vào repo.
 */

const img = (seed: string, w = 1200, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const policy = (cancelBeforeHours: number, refundPercent: number, depositPercent: number): CancellationPolicy => ({
  cancelBeforeHours,
  refundPercent,
  depositPercent,
});

/** Tìm theo id, ném lỗi nếu thiếu – giúp phát hiện lỗi dữ liệu sớm. */
function pick<T extends { id: string }>(list: T[], id: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`[mocks] Không tìm thấy id ${id}`);
  return found;
}

export const courtIdForVenue = (venueId: string, number: number) =>
  `${venueId.slice(0, 24)}${venueId.slice(-4)}${String(number).padStart(4, '0')}`;

function courtsOf(venueId: string, names: string[], sportId: string): Court[] {
  return names.map((name, i) => ({
    id: courtIdForVenue(venueId, i + 1),
    name,
    description: null,
    sportId,
    status: 'active',
  }));
}

interface VenueSeed {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  provinceId: string;
  districtId: string;
  lat: number;
  lng: number;
  coverSeed: string;
  ratingAvg: number;
  reviewCount: number;
  fromPrice: number;
  sportIds: string[];
  amenityIds: string[];
  courtNames: string[];
  policy: CancellationPolicy;
  status?: VenueDetail['status'];
}

const OWNER_1 = '019273c5-7f12-7000-8000-000000000001';
const OWNER_2 = '019273c5-7f12-7000-8000-000000000006';

const seeds: VenueSeed[] = [
  {
    id: '019273c5-7f12-7001-a1b2-c3d4e5f60001',
    ownerId: OWNER_1,
    name: 'Sân Cầu Lông Thăng Long',
    slug: 'san-cau-long-thang-long',
    description:
      'Sân thảm tiêu chuẩn thi đấu, đèn LED chống chói, trần cao 9m. Có 6 sân đơn và đôi, phù hợp cả tập luyện lẫn giải phong trào. Giữ xe miễn phí, có căng tin phục vụ nước uống và đồ ăn nhẹ.',
    address: '123 Hoàng Diệu, Phường 1',
    provinceId: provinces[0]!.id,
    districtId: districts[0]!.id,
    lat: 10.776889,
    lng: 106.700806,
    coverSeed: 'bsc-badminton-1',
    ratingAvg: 4.8,
    reviewCount: 42,
    fromPrice: 80000,
    sportIds: [sports[0]!.id],
    amenityIds: [amenities[0]!.id, amenities[1]!.id, amenities[2]!.id, amenities[3]!.id, amenities[6]!.id],
    courtNames: ['Sân 1 (Thảm xanh)', 'Sân 2 (Thảm xanh)', 'Sân 3 (Thảm đỏ)', 'Sân 4 (Thảm đỏ)'],
    policy: policy(24, 100, 100),
  },
  {
    id: '019273c5-7f12-7001-a1b2-c3d4e5f60002',
    ownerId: OWNER_1,
    name: 'Sân Bóng Đá Phú Thọ',
    slug: 'san-bong-da-phu-tho',
    description:
      'Cụm 2 sân bóng đá 7 người mặt cỏ nhân tạo thế hệ mới, lưới chắn bóng cao. Có đèn chiếu sáng ban đêm, phòng thay đồ riêng cho từng đội.',
    address: '219 Lý Thường Kiệt, Phường 15',
    provinceId: provinces[0]!.id,
    districtId: districts[1]!.id,
    lat: 10.7689,
    lng: 106.6597,
    coverSeed: 'bsc-football-1',
    ratingAvg: 4.5,
    reviewCount: 28,
    fromPrice: 300000,
    sportIds: [sports[1]!.id],
    amenityIds: [amenities[0]!.id, amenities[1]!.id, amenities[6]!.id, amenities[8]!.id, amenities[9]!.id],
    courtNames: ['Sân A', 'Sân B'],
    policy: policy(12, 50, 50),
  },
  {
    id: '019273c5-7f12-7001-a1b2-c3d4e5f60003',
    ownerId: OWNER_2,
    name: 'Pickleball Club Sala',
    slug: 'pickleball-club-sala',
    description:
      'Sân Pickleball trong nhà, mái che hoàn toàn, không lo mưa nắng. 4 sân tiêu chuẩn APA, cho thuê vợt và bóng tại chỗ.',
    address: '10 Mai Chí Thọ, Phường An Lợi Đông',
    provinceId: provinces[0]!.id,
    districtId: districts[4]!.id,
    lat: 10.7769,
    lng: 106.7219,
    coverSeed: 'bsc-pickleball-1',
    ratingAvg: 4.9,
    reviewCount: 67,
    fromPrice: 150000,
    sportIds: [sports[2]!.id],
    amenityIds: [amenities[0]!.id, amenities[1]!.id, amenities[4]!.id, amenities[5]!.id, amenities[7]!.id],
    courtNames: ['Sân 1', 'Sân 2', 'Sân 3', 'Sân 4'],
    policy: policy(24, 100, 100),
  },
  {
    id: '019273c5-7f12-7001-a1b2-c3d4e5f60004',
    ownerId: OWNER_2,
    name: 'Sân Tennis Bình Thạnh',
    slug: 'san-tennis-binh-thanh',
    description:
      'Sân tennis ngoài trời mặt sân cứng tiêu chuẩn ITF. Có 3 sân, đèn cao áp đủ sáng chơi tối.',
    address: '45 Nguyễn Hữu Cảnh, Phường 22',
    provinceId: provinces[0]!.id,
    districtId: districts[3]!.id,
    lat: 10.8014,
    lng: 106.7109,
    coverSeed: 'bsc-tennis-1',
    ratingAvg: 4.2,
    reviewCount: 19,
    fromPrice: 120000,
    sportIds: [sports[3]!.id],
    amenityIds: [amenities[0]!.id, amenities[1]!.id, amenities[2]!.id, amenities[8]!.id],
    courtNames: ['Sân 1', 'Sân 2', 'Sân 3'],
    policy: policy(24, 80, 100),
  },
  {
    id: '019273c5-7f12-7001-a1b2-c3d4e5f60005',
    ownerId: OWNER_1,
    name: 'Trung tâm Thể thao Cầu Giấy',
    slug: 'trung-tam-the-thao-cau-giay',
    description:
      'Tổ hợp đa môn: cầu lông, bóng rổ và bóng chuyền trong cùng một nhà thi đấu. Sức chứa khán giả 200 chỗ.',
    address: '88 Trần Duy Hưng, Phường Trung Hoà',
    provinceId: provinces[1]!.id,
    districtId: districts[4]!.id,
    lat: 21.0069,
    lng: 105.7975,
    coverSeed: 'bsc-multisport-1',
    ratingAvg: 4.6,
    reviewCount: 53,
    fromPrice: 90000,
    sportIds: [sports[0]!.id, sports[4]!.id, sports[5]!.id],
    amenityIds: [amenities[0]!.id, amenities[1]!.id, amenities[2]!.id, amenities[3]!.id, amenities[5]!.id, amenities[9]!.id],
    courtNames: ['Sân cầu lông 1', 'Sân cầu lông 2', 'Sân bóng rổ', 'Sân bóng chuyền'],
    policy: policy(24, 100, 100),
  },
  {
    id: '019273c5-7f12-7001-a1b2-c3d4e5f60006',
    ownerId: OWNER_2,
    name: 'Sân Cầu Lông Đống Đa',
    slug: 'san-cau-long-dong-da',
    description: 'Sân cầu lông giá rẻ cho sinh viên, 5 sân thảm PVC. Ưu đãi giờ sáng sớm.',
    address: '12 Chùa Bộc, Phường Quang Trung',
    provinceId: provinces[1]!.id,
    districtId: districts[5]!.id,
    lat: 21.0075,
    lng: 105.8275,
    coverSeed: 'bsc-badminton-2',
    ratingAvg: 4.0,
    reviewCount: 31,
    fromPrice: 60000,
    sportIds: [sports[0]!.id],
    amenityIds: [amenities[2]!.id, amenities[8]!.id, amenities[6]!.id],
    courtNames: ['Sân 1', 'Sân 2', 'Sân 3', 'Sân 4', 'Sân 5'],
    policy: policy(12, 50, 50),
  },
  {
    id: '019273c5-7f12-7001-a1b2-c3d4e5f60007',
    ownerId: OWNER_1,
    name: 'Sân Bóng Đá Hải Châu',
    slug: 'san-bong-da-hai-chau',
    description: 'Sân bóng đá mini 5 người ven sông Hàn, view đẹp, gió mát về chiều.',
    address: '36 Bạch Đằng, Phường Thạch Thang',
    provinceId: provinces[2]!.id,
    districtId: districts[7]!.id,
    lat: 16.0748,
    lng: 108.224,
    coverSeed: 'bsc-football-2',
    ratingAvg: 4.4,
    reviewCount: 22,
    fromPrice: 200000,
    sportIds: [sports[1]!.id],
    amenityIds: [amenities[0]!.id, amenities[1]!.id, amenities[3]!.id, amenities[8]!.id],
    courtNames: ['Sân 1', 'Sân 2'],
    policy: policy(24, 100, 100),
  },
  {
    id: '019273c5-7f12-7001-a1b2-c3d4e5f60008',
    ownerId: OWNER_2,
    name: 'Sân Pickleball Sơn Trà',
    slug: 'san-pickleball-son-tra',
    description: 'Sân Pickleball gần biển Mỹ Khê, mở cửa từ 5h sáng cho người chơi sớm.',
    address: '05 Võ Nguyên Giáp, Phường Phước Mỹ',
    provinceId: provinces[2]!.id,
    districtId: districts[8]!.id,
    lat: 16.0544,
    lng: 108.2472,
    coverSeed: 'bsc-pickleball-2',
    ratingAvg: 4.7,
    reviewCount: 38,
    fromPrice: 130000,
    sportIds: [sports[2]!.id],
    amenityIds: [amenities[0]!.id, amenities[2]!.id, amenities[4]!.id, amenities[7]!.id],
    courtNames: ['Sân 1', 'Sân 2', 'Sân 3'],
    policy: policy(24, 100, 100),
  },
];

export const venues: VenueDetail[] = seeds.map((s) => {
  const province = provinces.find((p) => p.id === s.provinceId)!;
  const district = districts.find((d) => d.id === s.districtId)!;

  return {
    id: s.id,
    ownerId: s.ownerId,
    name: s.name,
    slug: s.slug,
    description: s.description,
    address: s.address,
    provinceId: s.provinceId,
    districtId: s.districtId,
    province: { id: province.id, name: province.name, slug: province.slug },
    district: {
      id: district.id,
      name: district.name,
      slug: district.slug,
      provinceId: district.parentId ?? province.id,
    },
    lat: s.lat,
    lng: s.lng,
    status: s.status ?? 'approved',
    coverUrl: img(s.coverSeed),
    ratingAvg: s.ratingAvg,
    reviewCount: s.reviewCount,
    fromPrice: s.fromPrice,
    images: Array.from({ length: 5 }, (_, i) => ({
      id: `${s.id.slice(0, 24)}${String(i + 100).padStart(4, '0')}`,
      url: img(`${s.coverSeed}-${i}`),
      sortOrder: i,
    })),
    sports: s.sportIds.map((id) => pick(sports, id)),
    amenities: s.amenityIds.map((id) => pick(amenities, id)),
    courts: courtsOf(s.id, s.courtNames, s.sportIds[0]!),
    cancellationPolicy: s.policy,
  };
});

/** Sân con tra theo id trên toàn hệ thống. */
export const allCourts: Array<Court & { venueId: string }> = venues.flatMap((v) =>
  v.courts.map((c) => ({ ...c, venueId: v.id })),
);

/**
 * Giờ mở cửa mẫu cho từng cơ sở (OWN-04):
 * - Sân Cầu Lông Thăng Long: T2–T6 06:00–22:00, T7–CN 06:00–23:00.
 * - Sân Bóng Đá Phú Thọ: ca sáng 06:00–14:00 mọi ngày (theo ca đặt sân thực tế).
 * - Pickleball Club Sala: 07:00–21:00.
 * - Sân Tennis Bình Thạnh: T2–T7 06:00–20:00, CN mở nửa ngày 06:00–12:00.
 * - Trung tâm Thể thao Cầu Giấy: 08:00–22:00.
 */
export const openingHours: OpeningHour[] = venues.flatMap((v) =>
  Array.from({ length: 7 }, (_, weekday) => {
    const isWeekend = weekday === 0 || weekday === 6;
    let openTime = '06:00';
    let closeTime = '22:00';

    if (v.slug === 'san-bong-da-phu-tho') {
      // Đúng kịch bản kiểm thử: mở từ 6h sáng đến 14h chiều
      openTime = '06:00';
      closeTime = '14:00';
    } else if (v.slug === 'san-cau-long-thang-long') {
      openTime = '06:00';
      closeTime = isWeekend ? '23:00' : '22:00';
    } else if (v.slug === 'pickleball-club-sala') {
      openTime = '07:00';
      closeTime = '21:00';
    } else if (v.slug === 'san-tennis-binh-thanh') {
      openTime = '06:00';
      closeTime = weekday === 0 ? '12:00' : '20:00';
    } else if (v.slug === 'trung-tam-the-thao-cau-giay') {
      openTime = '08:00';
      closeTime = '22:00';
    }

    return {
      id: `${v.id.slice(0, 22)}oh${weekday}`,
      courtId: null,
      venueId: v.id,
      weekday,
      openTime,
      closeTime,
      isClosed: false,
    };
  }),
);

/**
 * Bảng giá theo khung giờ. Giá vàng (17h–22h) cao hơn để lưới slot có nhiều
 * mức giá khác nhau — đúng yêu cầu "hiện giá per slot" của SlotGrid.
 */
export const pricingRules: PricingRule[] = venues.flatMap((v) => {
  const base = v.fromPrice;
  return [
    {
      id: `${v.id.slice(0, 22)}pr1`,
      courtId: null,
      venueId: v.id,
      label: 'Giờ thường',
      weekdays: [1, 2, 3, 4, 5, 6, 0],
      startTime: '06:00',
      endTime: '17:00',
      pricePerSlot: base,
    },
    {
      id: `${v.id.slice(0, 22)}pr2`,
      courtId: null,
      venueId: v.id,
      label: 'Giờ vàng',
      weekdays: [1, 2, 3, 4, 5, 6, 0],
      startTime: '17:00',
      endTime: '22:00',
      pricePerSlot: Math.round((base * 1.4) / 1000) * 1000,
    },
    {
      id: `${v.id.slice(0, 22)}pr3`,
      courtId: null,
      venueId: v.id,
      label: 'Giờ muộn',
      weekdays: [1, 2, 3, 4, 5, 6, 0],
      startTime: '22:00',
      endTime: '23:00',
      pricePerSlot: Math.round((base * 0.8) / 1000) * 1000,
    },
  ];
});

/**
 * Khoá sân bảo trì mẫu (mặc định để trống để chủ sân tự tạo và mở khoá theo nhu cầu).
 */
export const blackouts: Blackout[] = [];
