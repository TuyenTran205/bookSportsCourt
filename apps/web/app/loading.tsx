import { PageLoader } from '@/components/ui/page-loader';

/** Fallback toàn ứng dụng – docs/specs/loading-states-spec.md (SPEC-FE-LOADING-01). */
export default function RootLoading() {
  return <PageLoader fullscreen label="Đang tải trang…" />;
}
