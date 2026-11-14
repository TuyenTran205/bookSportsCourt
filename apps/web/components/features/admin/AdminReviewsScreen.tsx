'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  MessageSquare,
  MessageSquareOff,
  Search,
  Star,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import {
  useAdminReviews,
  useModerateReviewReport,
  useSetReviewVisibility,
  type AdminReviewRow,
} from '@/lib/hooks/useAdminReviews';
import { useAdminVenues } from '@/lib/hooks/useAdminVenues';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';

export function getReportBadge(status: AdminReviewRow['reportStatus']) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
        <AlertTriangle className="size-3" aria-hidden="true" />
        Chờ duyệt báo cáo
      </span>
    );
  }
  if (status === 'resolved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
        Đã duyệt báo cáo
      </span>
    );
  }
  if (status === 'dismissed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary">
        Đã bác bỏ báo cáo
      </span>
    );
  }
  return null;
}

export function AdminReviewsScreen() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const [page, setPage] = React.useState(1);
  const [venueFilter, setVenueFilter] = React.useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = React.useState<string>('all');
  const [reportFilter, setReportFilter] = React.useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [ratingFilter, setRatingFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Dialog xác nhận ẩn/hiện & xử lý báo cáo
  const [confirmTarget, setConfirmTarget] = React.useState<AdminReviewRow | null>(null);
  const [reportActionTarget, setReportActionTarget] = React.useState<{
    review: AdminReviewRow;
    action: 'approve' | 'reject';
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const venuesQuery = useAdminVenues({ limit: 100 });
  const venues = venuesQuery.data?.data ?? [];

  const parsedVisibility = React.useMemo(() => {
    if (visibilityFilter === 'true') return true;
    if (visibilityFilter === 'false') return false;
    return undefined;
  }, [visibilityFilter]);

  const parsedRating = React.useMemo(() => {
    if (ratingFilter === 'all') return undefined;
    const r = Number(ratingFilter);
    return Number.isNaN(r) ? undefined : r;
  }, [ratingFilter]);

  const reviewsQuery = useAdminReviews({
    page,
    limit: 10,
    venueId: venueFilter || undefined,
    isVisible: parsedVisibility,
    reportStatus: reportFilter === 'all' ? undefined : reportFilter,
    rating: parsedRating,
    q: debouncedSearch.trim() || undefined,
  });

  const toggleVisibility = useSetReviewVisibility();
  const moderateReport = useModerateReviewReport();

  const reviews = reviewsQuery.data?.data ?? [];
  const meta = reviewsQuery.data?.meta;

  const handleOpenConfirm = (review: AdminReviewRow) => {
    setConfirmTarget(review);
  };

  const handleConfirmToggle = async () => {
    if (!confirmTarget) return;
    const targetIsVisible = !confirmTarget.isVisible;
    setIsSubmitting(true);
    try {
      await toggleVisibility.mutateAsync({
        id: confirmTarget.id,
        isVisible: targetIsVisible,
      });
      toast.success(t('toggleSuccess'));
      setConfirmTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('toggleFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReportModeration = async () => {
    if (!reportActionTarget) return;
    setIsSubmitting(true);
    try {
      await moderateReport.mutateAsync({
        id: reportActionTarget.review.id,
        action: reportActionTarget.action,
      });
      toast.success(
        reportActionTarget.action === 'approve'
          ? 'Đã duyệt báo cáo và ẩn đánh giá'
          : 'Đã bác bỏ báo cáo từ chủ sân',
      );
      setReportActionTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể xử lý báo cáo đánh giá');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('reviewsTitle')}
        description={t('reviewsSubtitle')}
      />

      {/* Bộ lọc nhanh trạng thái báo cáo từ chủ sân */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'all', label: 'Tất cả đánh giá' },
            { key: 'pending', label: 'Bị chủ sân báo cáo' },
            { key: 'resolved', label: 'Đã duyệt báo cáo' },
            { key: 'dismissed', label: 'Đã bác bỏ báo cáo' },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={reportFilter === tab.key ? 'primary' : 'outline'}
            onClick={() => {
              setReportFilter(tab.key);
              setPage(1);
            }}
          >
            {tab.key === 'pending' && <AlertTriangle className="mr-1.5 size-3.5" aria-hidden="true" />}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Thanh bộ lọc */}
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-disabled" />
            <Input
              type="text"
              placeholder={t('searchReviewPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label={t('searchReviewPlaceholder')}
            />
          </div>

          {/* Chọn cơ sở */}
          <div>
            <select
              value={venueFilter}
              onChange={(e) => {
                setVenueFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-btn border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              aria-label={t('filterVenue')}
            >
              <option value="">{t('allVenues')}</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn trạng thái hiển thị */}
          <div>
            <select
              value={visibilityFilter}
              onChange={(e) => {
                setVisibilityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-btn border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              aria-label={t('filterStatus')}
            >
              <option value="all">{t('statusAll')}</option>
              <option value="true">{t('statusPublic')}</option>
              <option value="false">{t('statusHidden')}</option>
            </select>
          </div>

          {/* Chọn số sao */}
          <div>
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-btn border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              aria-label={t('filterRating')}
            >
              <option value="all">{t('ratingAll')}</option>
              <option value="5">{t('starCount', { n: 5 })}</option>
              <option value="4">{t('starCount', { n: 4 })}</option>
              <option value="3">{t('starCount', { n: 3 })}</option>
              <option value="2">{t('starCount', { n: 2 })}</option>
              <option value="1">{t('starCount', { n: 1 })}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Bảng dữ liệu & trạng thái */}
      {reviewsQuery.isLoading ? (
        <Card className="p-4">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 border-b border-border pb-4 last:border-b-0">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-8 w-24 rounded-btn" />
              </div>
            ))}
          </div>
        </Card>
      ) : reviewsQuery.isError ? (
        <ErrorState
          error={reviewsQuery.error}
          onRetry={() => reviewsQuery.refetch()}
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareOff}
          title={t('noReviewsFound')}
          description={t('noReviewsFoundDesc')}
          action={
            (searchQuery || venueFilter || visibilityFilter !== 'all' || reportFilter !== 'all' || ratingFilter !== 'all') ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setVenueFilter('');
                  setVisibilityFilter('all');
                  setReportFilter('all');
                  setRatingFilter('all');
                  setPage(1);
                }}
              >
                {tCommon('resetFilter')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="admin-reviews-table">
              <thead className="border-b border-border bg-bg-subtle text-xs font-semibold text-text-secondary">
                <tr>
                  <th scope="col" className="px-4 py-3">{t('colCustomer')}</th>
                  <th scope="col" className="px-4 py-3">{t('colVenue')}</th>
                  <th scope="col" className="px-4 py-3 min-w-[260px]">{t('colContent')}</th>
                  <th scope="col" className="px-4 py-3">{t('colStatus')}</th>
                  <th scope="col" className="px-4 py-3 text-right">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reviews.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-bg-subtle/50">
                    {/* Cột 1: Khách hàng */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-text-secondary">
                          <User className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-text-primary">{row.customerName}</div>
                          <div className="text-xs text-text-secondary">{formatDate(row.createdAt)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Cột 2: Cơ sở */}
                    <td className="px-4 py-3 align-top font-medium text-text-primary">
                      {row.venueName}
                    </td>

                    {/* Cột 3: Điểm số & Bình luận */}
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'size-3.5',
                                i < row.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-text-disabled',
                              )}
                            />
                          ))}
                          <span className="ml-1 text-xs font-semibold text-text-secondary">
                            {row.rating}/5
                          </span>
                        </div>
                        <p className="text-text-primary leading-relaxed text-sm">
                          {row.comment || <span className="italic text-text-disabled">{t('reviewNoComment')}</span>}
                        </p>
                        {row.ownerReply && (
                          <div className="rounded-md border border-border bg-bg-subtle p-2 text-xs text-text-secondary">
                            <span className="font-semibold text-text-primary">{t('ownerReply')} </span>
                            {row.ownerReply}
                          </div>
                        )}
                        {row.reportStatus && row.reportStatus !== 'none' && (
                          <div className="mt-2 space-y-1.5 rounded-md border border-amber-300 bg-amber-50/70 p-2.5 text-xs dark:border-amber-800/60 dark:bg-amber-950/30">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              {getReportBadge(row.reportStatus)}
                              {row.reportedAt && (
                                <span className="text-[11px] text-text-secondary">
                                  {formatDate(row.reportedAt)}
                                </span>
                              )}
                            </div>
                            {row.reportReason && (
                              <p className="text-text-primary">
                                <span className="font-semibold">Lý do báo cáo: </span>
                                {row.reportReason}
                              </p>
                            )}
                            {row.reportImageUrl && (
                              <a
                                href={row.reportImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={row.reportImageUrl}
                                  alt="Ảnh minh chứng báo cáo"
                                  className="mt-1 max-h-24 rounded border border-border object-cover"
                                />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Cột 4: Trạng thái */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        {row.isVisible ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300">
                            <span className="size-1.5 rounded-full bg-primary-600" />
                            {t('badgePublic')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-subtle px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                            <span className="size-1.5 rounded-full bg-text-disabled" />
                            {t('badgeHidden')}
                          </span>
                        )}
                        {getReportBadge(row.reportStatus)}
                      </div>
                    </td>

                    {/* Cột 5: Thao tác */}
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {row.reportStatus === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReportActionTarget({ review: row, action: 'approve' })}
                              className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50"
                            >
                              <Check className="mr-1 size-3.5" aria-hidden="true" />
                              Duyệt &amp; Ẩn
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReportActionTarget({ review: row, action: 'reject' })}
                              className="hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                            >
                              <X className="mr-1 size-3.5" aria-hidden="true" />
                              Bác bỏ
                            </Button>
                          </>
                        )}
                        {row.isVisible ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenConfirm(row)}
                            className="hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                            aria-label={t('hideReview')}
                          >
                            <EyeOff className="mr-1 size-4 text-text-secondary group-hover:text-red-700" />
                            <span>{t('hideReview')}</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenConfirm(row)}
                            className="hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-800 dark:hover:bg-primary-950/40 dark:hover:text-primary-300"
                            aria-label={t('showReview')}
                          >
                            <Eye className="mr-1 size-4 text-text-secondary group-hover:text-primary-700" />
                            <span>{t('showReview')}</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="border-t border-border p-4">
              <Pagination
                meta={meta}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </Card>
      )}

      {/* Dialog xác nhận ẩn/hiện */}
      <Dialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && !isSubmitting && setConfirmTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTarget?.isVisible ? t('hideConfirmTitle') : t('showConfirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.isVisible ? t('hideConfirmDesc') : t('showConfirmDesc')}
            </DialogDescription>
          </DialogHeader>

          {confirmTarget && (
            <div className="space-y-1 rounded-md border border-border bg-bg-subtle p-3 text-xs text-text-secondary">
              <div className="font-semibold text-text-primary">
                {confirmTarget.customerName} · {confirmTarget.venueName}
              </div>
              <p className="line-clamp-3 italic">&quot;{confirmTarget.comment || 'Không có bình luận'}&quot;</p>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmTarget(null)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button
              variant={confirmTarget?.isVisible ? 'danger' : 'primary'}
              onClick={handleConfirmToggle}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {confirmTarget?.isVisible ? t('confirmHide') : t('confirmShow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận duyệt / bác bỏ báo cáo đánh giá từ chủ sân */}
      <Dialog
        open={Boolean(reportActionTarget)}
        onOpenChange={(open) => !open && !isSubmitting && setReportActionTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reportActionTarget?.action === 'approve'
                ? 'Duyệt báo cáo và ẩn đánh giá?'
                : 'Bác bỏ báo cáo của chủ sân?'}
            </DialogTitle>
            <DialogDescription>
              {reportActionTarget?.action === 'approve'
                ? 'Đánh giá này sẽ bị ẩn khỏi trang công khai của cơ sở.'
                : 'Báo cáo sẽ được đánh dấu từ chối và đánh giá giữ nguyên trạng thái hiện tại.'}
            </DialogDescription>
          </DialogHeader>

          {reportActionTarget && (
            <div className="space-y-2 rounded-md border border-border bg-bg-subtle p-3 text-xs text-text-secondary">
              <div className="font-semibold text-text-primary">
                {reportActionTarget.review.customerName} · {reportActionTarget.review.venueName}
              </div>
              <p className="italic">
                &quot;{reportActionTarget.review.comment || 'Không có bình luận'}&quot;
              </p>
              {reportActionTarget.review.reportReason && (
                <p className="border-t border-border pt-2 text-text-primary">
                  <span className="font-semibold">Lý do chủ sân báo cáo: </span>
                  {reportActionTarget.review.reportReason}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setReportActionTarget(null)}
              disabled={isSubmitting}
            >
              Huỷ
            </Button>
            <Button
              variant={reportActionTarget?.action === 'approve' ? 'danger' : 'primary'}
              onClick={handleConfirmReportModeration}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {reportActionTarget?.action === 'approve' ? 'Xác nhận Duyệt & Ẩn' : 'Xác nhận Bác bỏ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
