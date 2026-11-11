import * as React from 'react';
import {
  Activity,
  Trophy,
  Target,
  Dumbbell,
  Flame,
  Zap,
  Medal,
  Footprints,
  Heart,
  Timer,
  Shield,
  Bike,
  Waves,
  Flag,
  Swords,
  CircleDot,
  Circle,
  Table2,
  CircleDashed,
  Sparkles,
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
  type LucideIcon,
} from 'lucide-react';

export interface CatalogIconOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const SPORT_ICON_OPTIONS: CatalogIconOption[] = [
  { id: 'activity', label: 'Vận động chung', icon: Activity },
  { id: 'circle-dot', label: 'Bóng đá', icon: CircleDot },
  { id: 'table-2', label: 'Pickleball / Bóng bàn', icon: Table2 },
  { id: 'circle', label: 'Tennis / Quần vợt', icon: Circle },
  { id: 'circle-dashed', label: 'Bóng rổ', icon: CircleDashed },
  { id: 'trophy', label: 'Cúp giải đấu', icon: Trophy },
  { id: 'medal', label: 'Huy chương', icon: Medal },
  { id: 'target', label: 'Mục tiêu / Bắn cung', icon: Target },
  { id: 'dumbbell', label: 'Gym / Thể hình', icon: Dumbbell },
  { id: 'waves', label: 'Bơi lội / Nước', icon: Waves },
  { id: 'bike', label: 'Đua xe đạp', icon: Bike },
  { id: 'footprints', label: 'Điền kinh / Chạy bộ', icon: Footprints },
  { id: 'flame', label: 'Nhiệt huyết / Khởi động', icon: Flame },
  { id: 'zap', label: 'Tốc độ / Phản xạ', icon: Zap },
  { id: 'heart', label: 'Yoga / Sức khoẻ', icon: Heart },
  { id: 'timer', label: 'Tính giờ / Thể lực', icon: Timer },
  { id: 'shield', label: 'Võ thuật / Tự vệ', icon: Shield },
  { id: 'flag', label: 'Golf / Cờ', icon: Flag },
  { id: 'swords', label: 'Đối kháng / Kiếm', icon: Swords },
  { id: 'sparkles', label: 'Khác', icon: Sparkles },
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
  { id: 'trophy', label: 'Khán đài / Cổ vũ', icon: Trophy },
  { id: 'sparkles', label: 'Tiện ích tiêu chuẩn', icon: Sparkles },
];

const ALL_ICONS_MAP: Record<string, LucideIcon> = {
  // Sports
  activity: Activity,
  'circle-dot': CircleDot,
  'table-2': Table2,
  circle: Circle,
  'circle-dashed': CircleDashed,
  trophy: Trophy,
  medal: Medal,
  target: Target,
  dumbbell: Dumbbell,
  waves: Waves,
  bike: Bike,
  footprints: Footprints,
  flame: Flame,
  zap: Zap,
  heart: Heart,
  timer: Timer,
  shield: Shield,
  flag: Flag,
  swords: Swords,
  badminton: Activity,
  soccer: CircleDot,
  tennis: Circle,
  pickleball: Table2,
  volleyball: CircleDot,

  // Amenities
  car: Car,
  coffee: Coffee,
  utensils: Utensils,
  wifi: Wifi,
  'shower-head': ShowerHead,
  shower: ShowerHead,
  shirt: Shirt,
  locker: Shirt,
  'phong-thay-do': Shirt,
  lightbulb: Lightbulb,
  'den-chieu-sang': Lightbulb,
  fan: Fan,
  'battery-charging': BatteryCharging,
  tv: Tv,
  store: Store,
  sparkles: Sparkles,
};

export function renderCatalogIcon(
  iconName: string | null | undefined,
  fallback: LucideIcon = Sparkles,
  className = 'size-4',
) {
  const IconComponent = (iconName ? ALL_ICONS_MAP[iconName.toLowerCase()] : null) ?? fallback;
  return <IconComponent className={className} />;
}
