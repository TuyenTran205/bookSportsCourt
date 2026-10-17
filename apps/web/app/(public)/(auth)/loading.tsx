import { PageLoader } from '@/components/ui/page-loader';

/**
 * Nhóm biểu mẫu xác thực – /login, /register, /forgot-password, /reset-password,
 * /verify-email. Giữ khung hẹp để vòng xoay nằm đúng vị trí thẻ form.
 */
export default function AuthLoading() {
  return (
    <main className="container flex min-h-[calc(100vh-4rem-12rem)] items-center justify-center py-12">
      <PageLoader className="min-h-0" label="Đang mở biểu mẫu…" />
    </main>
  );
}
