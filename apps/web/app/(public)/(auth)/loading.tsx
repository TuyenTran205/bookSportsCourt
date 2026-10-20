import { PageSkeleton } from '@/components/ui/page-skeleton';

/** Nhóm biểu mẫu xác thực – /login, /register, /forgot-password, /reset-password, /verify-email. */
export default function AuthLoading() {
  return <PageSkeleton variant="form" />;
}
