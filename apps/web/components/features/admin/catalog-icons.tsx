import * as React from 'react';
import {
  Car,
  Coffee,
  Utensils,
  Wifi,
  ShowerHead,
  Shirt,
  Lightbulb,
  Fan,
  BatteryCharging,
  Tv,
  Store,
  Sparkles,
  Bike,
  type LucideIcon,
} from 'lucide-react';

import { SportPinIcon } from '@/components/common/SportPinIcon';

export interface CatalogIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function createSportPinComponent(sportId: string) {
  const Component = ({ className }: { className?: string }) => (
    <SportPinIcon sport={sportId} className={className} />
  );
  Component.displayName = `SportPin_${sportId}`;
  return Component;
}

export const SPORT_ICON_OPTIONS: CatalogIconOption[] = [
  { id: 'badminton', label: 'Cầu lông', icon: createSportPinComponent('badminton') },
  { id: 'soccer', label: 'Bóng đá / Bóng mini', icon: createSportPinComponent('soccer') },
  { id: 'pickleball', label: 'Pickleball', icon: createSportPinComponent('pickleball') },
  { id: 'tennis', label: 'Tennis / Quần vợt', icon: createSportPinComponent('tennis') },
  { id: 'basketball', label: 'Bóng rổ', icon: createSportPinComponent('basketball') },
  { id: 'volleyball', label: 'Bóng chuyền', icon: createSportPinComponent('volleyball') },
  { id: 'table-tennis', label: 'Bóng bàn', icon: createSportPinComponent('table-tennis') },
  { id: 'swimming', label: 'Bơi lội', icon: createSportPinComponent('swimming') },
  { id: 'gym', label: 'Gym / Thể hình', icon: createSportPinComponent('gym') },
  { id: 'running', label: 'Điền kinh / Chạy bộ', icon: createSportPinComponent('running') },
  { id: 'golf', label: 'Golf', icon: createSportPinComponent('golf') },
  { id: 'billiards', label: 'Bida / Billiards', icon: createSportPinComponent('billiards') },
  { id: 'martial-arts', label: 'Võ thuật / Tự vệ', icon: createSportPinComponent('martial-arts') },
  { id: 'bowling', label: 'Bowling', icon: createSportPinComponent('bowling') },
  { id: 'archery', label: 'Bắn cung', icon: createSportPinComponent('archery') },
  { id: 'cycling', label: 'Đua xe đạp', icon: createSportPinComponent('cycling') },
  { id: 'climbing', label: 'Leo núi nhân tạo', icon: createSportPinComponent('climbing') },
  { id: 'skating', label: 'Trượt patin / Ván trượt', icon: createSportPinComponent('skating') },
  { id: 'yoga', label: 'Yoga / Pilates', icon: createSportPinComponent('yoga') },
  { id: 'general', label: 'Thể thao khác / Chung', icon: createSportPinComponent('general') },
];

export const AMENITY_ICON_OPTIONS: CatalogIconOption[] = [
  { id: 'car', label: 'Bãi đỗ ô tô', icon: Car },
  { id: 'bike', label: 'Bãi đỗ xe máy', icon: Bike },
  { id: 'coffee', label: 'Căn tin / Nước uống', icon: Coffee },
  { id: 'utensils', label: 'Ăn uống / Nhà hàng', icon: Utensils },
  { id: 'wifi', label: 'Wi-Fi miễn phí', icon: Wifi },
  { id: 'shower-head', label: 'Phòng tắm nóng lạnh', icon: ShowerHead },
  { id: 'shirt', label: 'Phòng thay đồ / Tủ gửi đồ', icon: Shirt },
  { id: 'lightbulb', label: 'Đèn chiếu sáng đêm', icon: Lightbulb },
  { id: 'fan', label: 'Điều hoà / Quạt gió', icon: Fan },
  { id: 'battery-charging', label: 'Trạm sạc xe điện', icon: BatteryCharging },
  { id: 'tv', label: 'Màn hình TV / Trực tiếp', icon: Tv },
  { id: 'store', label: 'Cho thuê đồ / Phụ kiện', icon: Store },
  { id: 'sparkles', label: 'Tiện ích tiêu chuẩn', icon: Sparkles },
];

const AMENITY_ICONS_MAP: Record<string, LucideIcon> = {
  car: Car,
  'bai-do-xe': Car,
  bike: Bike,
  'xe-may': Bike,
  coffee: Coffee,
  canteen: Coffee,
  'cang-tin': Coffee,
  utensils: Utensils,
  'an-uong': Utensils,
  wifi: Wifi,
  'wifi-mien-phi': Wifi,
  'shower-head': ShowerHead,
  shower: ShowerHead,
  'nha-ve-sinh': ShowerHead,
  shirt: Shirt,
  locker: Shirt,
  'phong-thay-do': Shirt,
  lightbulb: Lightbulb,
  'den-chieu-sang': Lightbulb,
  'den-led': Lightbulb,
  fan: Fan,
  'dieu-hoa': Fan,
  snowflake: Fan,
  'battery-charging': BatteryCharging,
  tv: Tv,
  store: Store,
  'thue-dung-cu': Store,
  'cho-thue-dung-cu': Store,
  backpack: Store,
  sports_tennis: Store,
  'may-ban-nuoc': Coffee,
  'cup-soda': Coffee,
  camera: Tv,
  video: Tv,
  sparkles: Sparkles,
};

export function renderCatalogIcon(
  iconName: string | null | undefined,
  fallback?: React.ComponentType<{ className?: string }>,
  className = 'size-4',
) {
  if (!iconName) {
    if (fallback) {
      const FallbackComponent = fallback;
      return <FallbackComponent className={className} />;
    }
    return <SportPinIcon sport="general" className={className} />;
  }

  const key = iconName.toLowerCase().trim();

  // If matched in amenity icons map, render amenity icon (Lucide)
  const AmenityComponent = AMENITY_ICONS_MAP[key];
  if (AmenityComponent) {
    return <AmenityComponent className={className} />;
  }

  // Otherwise, render inverted teardrop sport pin icon
  return <SportPinIcon sport={key} className={className} />;
}
