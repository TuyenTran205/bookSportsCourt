import type { Metadata } from 'next';

import { VenueCompareScreen } from '@/components/features/venue/VenueCompareScreen';

export const metadata: Metadata = {
  title: 'So sánh cơ sở thể thao | BookSportsCourt',
  description:
    'So sánh trực quan về giá, môn thể thao, tiện ích và đánh giá giữa các cơ sở thể thao hàng đầu.',
};

export default function VenueComparePage() {
  return <VenueCompareScreen />;
}
