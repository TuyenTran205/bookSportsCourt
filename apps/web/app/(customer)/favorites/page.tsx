import type { Metadata } from 'next';

import { FavoritesScreen } from '@/components/features/venue/FavoritesScreen';

export const metadata: Metadata = {
  title: 'Sân yêu thích',
  description: 'Danh sách các cơ sở thể thao bạn đã lưu.',
};

export default function FavoritesPage() {
  return <FavoritesScreen />;
}
