import { PageSkeleton } from '@/components/ui/page-skeleton';

/** Fallback tải dùng chung cho khu khách (Header/Footer đã do root layout render). */
export default function PublicLoading() {
  return <PageSkeleton variant="list" />;
}
