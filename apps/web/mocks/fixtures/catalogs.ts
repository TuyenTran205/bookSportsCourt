import type { Amenity, Area, Province, Sport, Ward } from '@bsc/shared';
import { PROVINCES } from '@bsc/shared';
import rawWards from '@bsc/shared/data/wards.json';

/**
 * Danh mục hệ thống – dữ liệu nền cho mọi màn hình.
 * Mốc ĐVHC 2 cấp 03/11/2026: 34 Tỉnh/Thành phố và 3.321 Xã/Phường.
 */

export const provinces: Province[] = PROVINCES;

export const wards: Ward[] = rawWards as Ward[];

// Tìm id tương ứng của các tỉnh lớn cho danh mục quận/huyện legacy
const hanoi = provinces.find((p) => p.code === '01')!;
const tphcm = provinces.find((p) => p.code === '79')!;
const danang = provinces.find((p) => p.code === '48')!;

export const districts: Area[] = [
  // TP. Hồ Chí Minh (legacy)
  { id: '019273c5-7f00-7000-0000-000000000002', name: 'Quận 1', slug: 'quan-1', type: 'district', parentId: tphcm.id },
  { id: '019273c5-7f00-7000-0000-000000000003', name: 'Quận 7', slug: 'quan-7', type: 'district', parentId: tphcm.id },
  { id: '019273c5-7f00-7000-0000-000000000004', name: 'Quận Bình Thạnh', slug: 'binh-thanh', type: 'district', parentId: tphcm.id },
  { id: '019273c5-7f00-7000-0000-000000000005', name: 'Thành phố Thủ Đức', slug: 'thu-duc', type: 'district', parentId: tphcm.id },
  // Hà Nội (legacy)
  { id: '019273c5-7f00-7000-0000-000000000011', name: 'Quận Cầu Giấy', slug: 'cau-giay', type: 'district', parentId: hanoi.id },
  { id: '019273c5-7f00-7000-0000-000000000012', name: 'Quận Đống Đa', slug: 'dong-da', type: 'district', parentId: hanoi.id },
  { id: '019273c5-7f00-7000-0000-000000000013', name: 'Quận Thanh Xuân', slug: 'thanh-xuan', type: 'district', parentId: hanoi.id },
  // Đà Nẵng (legacy)
  { id: '019273c5-7f00-7000-0000-000000000021', name: 'Quận Hải Châu', slug: 'hai-chau', type: 'district', parentId: danang.id },
  { id: '019273c5-7f00-7000-0000-000000000022', name: 'Quận Sơn Trà', slug: 'son-tra', type: 'district', parentId: danang.id },
];

/** Khu vực dạng cây cho tab "Khu vực" của Admin. */
export const areas: Area[] = [
  ...provinces.map<Area>((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    slug: p.slug,
    type: 'province',
    parentId: null,
    unaccentName: p.unaccentName,
  })),
  ...wards.map<Area>((w) => {
    const parentProv = provinces.find((p) => p.code === w.provinceCode);
    return {
      id: w.id,
      code: w.code,
      name: w.name,
      slug: w.slug,
      type: 'ward',
      parentId: parentProv?.id ?? null,
      unaccentName: w.unaccentName,
    };
  }),
  ...districts,
];

export const sports: Sport[] = [
  { id: '019273c5-7f00-7001-0000-000000000001', name: 'Cầu lông', slug: 'cau-long', icon: 'activity' },
  { id: '019273c5-7f00-7001-0000-000000000002', name: 'Bóng đá', slug: 'bong-da', icon: 'circle-dot' },
  { id: '019273c5-7f00-7001-0000-000000000003', name: 'Pickleball', slug: 'pickleball', icon: 'table-2' },
  { id: '019273c5-7f00-7001-0000-000000000004', name: 'Tennis', slug: 'tennis', icon: 'circle' },
  { id: '019273c5-7f00-7001-0000-000000000005', name: 'Bóng rổ', slug: 'bong-ro', icon: 'circle-dashed' },
  { id: '019273c5-7f00-7001-0000-000000000006', name: 'Bóng chuyền', slug: 'bong-chuyen', icon: 'volleyball' },
];

export const amenities: Amenity[] = [
  { id: '019273c5-7f00-7002-0000-000000000001', name: 'Bãi đỗ xe ô tô', slug: 'bai-do-xe', icon: 'car' },
  { id: '019273c5-7f00-7002-0000-000000000002', name: 'Phòng thay đồ', slug: 'phong-thay-do', icon: 'door-open' },
  { id: '019273c5-7f00-7002-0000-000000000003', name: 'Wi-Fi miễn phí', slug: 'wifi', icon: 'wifi' },
  { id: '019273c5-7f00-7002-0000-000000000004', name: 'Căng tin', slug: 'cang-tin', icon: 'utensils' },
  { id: '019273c5-7f00-7002-0000-000000000005', name: 'Cho thuê dụng cụ', slug: 'thue-dung-cu', icon: 'backpack' },
  { id: '019273c5-7f00-7002-0000-000000000006', name: 'Điều hoà', slug: 'dieu-hoa', icon: 'snowflake' },
  { id: '019273c5-7f00-7002-0000-000000000007', name: 'Đèn LED chống chói', slug: 'den-led', icon: 'lightbulb' },
  { id: '019273c5-7f00-7002-0000-000000000008', name: 'Máy bán nước tự động', slug: 'may-ban-nuoc', icon: 'cup-soda' },
  { id: '019273c5-7f00-7002-0000-000000000009', name: 'Nhà vệ sinh', slug: 'nha-ve-sinh', icon: 'toilet' },
  { id: '019273c5-7f00-7002-0000-00000000000a', name: 'Camera an ninh', slug: 'camera', icon: 'video' },
];
