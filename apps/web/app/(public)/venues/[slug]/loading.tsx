import { PageLoader } from '@/components/ui/page-loader';

/** Chi tiết cơ sở – /venues/[slug]. */
export default function VenueDetailLoading() {
  return <PageLoader label="Đang tải thông tin sân…" />;
}
