'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarCheck, CheckCircle2, LogIn, TrendingUp } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { ApplicationStatusCard } from '@/components/features/owner-apply/ApplicationStatusCard';
import { OwnerApplyForm } from '@/components/features/owner-apply/OwnerApplyForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks/useAuth';
import { useMyOwnerApplication } from '@/lib/hooks/useOwnerApply';

/**
 * Trang Đăng ký làm chủ sân (OWN-01 / BSC-062).
 * Cho phép khách hàng gửi biểu mẫu xin cấp quyền chủ sân và theo dõi trạng thái hồ sơ.
 */
export default function OwnerApplyPage() {
  const { user, role, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const applicationQuery = useMyOwnerApplication();
  const [isEditingRejected, setIsEditingRejected] = React.useState(false);

  const application = applicationQuery.data;
  const isLoading = isAuthLoading || applicationQuery.isPending;

  return (
    <main className="container max-w-4xl py-8 sm:py-12">
      <PageHeader
        title="Đăng ký mở cơ sở thể thao"
        description="Hợp tác cùng BookSportsCourt để kết nối với cộng đồng người chơi thể thao và tối ưu hoá doanh thu sân bãi."
      />

      <div className="mt-8">
        {isLoading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-40 w-full rounded-card" />
            <Skeleton className="h-96 w-full rounded-card" />
          </div>
        ) : !isAuthenticated ? (
          /* Trường hợp 1: Khách chưa đăng nhập */
          <div className="flex flex-col gap-8">
            <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <LogIn className="size-8" aria-hidden="true" />
              </div>

              <div className="max-w-md">
                <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl">
                  Đăng nhập để gửi hồ sơ đối tác
                </h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Bạn cần có tài khoản trên BookSportsCourt để chúng tôi có thể liên kết hồ sơ cơ sở
                  và cấp quyền quản trị chủ sân cho bạn.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button asChild variant="primary" size="lg">
                  <Link href="/login?redirect=/owner/apply">Đăng nhập ngay</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/register">Đăng ký tài khoản mới</Link>
                </Button>
              </div>
            </Card>

            {/* Lợi ích khi trở thành đối tác */}
            <div>
              <h3 className="mb-4 text-center text-lg font-bold text-neutral-900">
                Đặc quyền dành riêng cho Chủ sân trên BookSportsCourt
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-5">
                  <TrendingUp className="mb-2 size-6 text-primary-600" aria-hidden="true" />
                  <h4 className="font-semibold text-neutral-900">Tiếp cận 10.000+ người chơi</h4>
                  <p className="mt-1 text-xs text-neutral-500">
                    Sân của bạn sẽ xuất hiện trên bản đồ tìm kiếm và tiếp cận lượng khách hàng năng động.
                  </p>
                </Card>

                <Card className="p-5">
                  <CalendarCheck className="mb-2 size-6 text-primary-600" aria-hidden="true" />
                  <h4 className="font-semibold text-neutral-900">Quản lý lịch thời gian thực</h4>
                  <p className="mt-1 text-xs text-neutral-500">
                    Lịch sân trực quan, giữ chỗ tự động, chống trùng lịch triệt để bằng công nghệ DB EXCLUDE.
                  </p>
                </Card>

                <Card className="p-5">
                  <CheckCircle2 className="mb-2 size-6 text-primary-600" aria-hidden="true" />
                  <h4 className="font-semibold text-neutral-900">0đ phí khởi tạo nền tảng</h4>
                  <p className="mt-1 text-xs text-neutral-500">
                    Tiền cọc của khách chuyển khoản trực tiếp vào tài khoản ngân hàng của chủ sân.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        ) : role === 'owner' ? (
          /* Trường hợp 2: Tài khoản đã là chủ sân */
          <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </div>
            <div className="max-w-md">
              <h2 className="text-xl font-bold text-neutral-900">
                Tài khoản của bạn đã là Chủ sân
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Bạn đã được cấp quyền quản lý cơ sở thể thao, cấu hình giờ mở cửa và duyệt các khoản
                tiền cọc trên hệ thống.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/owner/dashboard">Vào Kênh quản lý Chủ sân</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/owner/venues">Quản lý cơ sở & Sân con</Link>
              </Button>
            </div>
          </Card>
        ) : application && !isEditingRejected ? (
          /* Trường hợp 3: Đã nộp hồ sơ (pending, rejected hoặc approved) */
          <ApplicationStatusCard
            application={application}
            onResubmit={() => setIsEditingRejected(true)}
          />
        ) : (
          /* Trường hợp 4: Nộp hồ sơ mới hoặc nộp lại sau khi bị từ chối */
          <div className="flex flex-col gap-6">
            {isEditingRejected && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Bạn đang cập nhật và nộp lại hồ sơ sau khi bị từ chối. Vui lòng kiểm tra kỹ các thông tin
                trước khi gửi lại.
              </div>
            )}
            <OwnerApplyForm
              defaultValues={{
                phone: user?.phone ?? '',
                businessName: application?.businessName ?? '',
                taxCode: application?.taxCode ?? '',
              }}
              onSuccess={() => setIsEditingRejected(false)}
            />
          </div>
        )}
      </div>
    </main>
  );
}
