import { PageLoader } from '@/components/ui/page-loader';

/**
 * Fallback tải dùng chung cho khu khách (Header/Footer đã do root layout render).
 * docs/specs/loading-states-spec.md – SPEC-FE-LOADING-01.
 */
export default function PublicLoading() {
  return <PageLoader label="Đang tải trang…" />;
}
