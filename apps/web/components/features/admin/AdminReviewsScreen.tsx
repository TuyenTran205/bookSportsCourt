'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Eye,
  EyeOff,
  Filter,
  Loader2,
  MessageSquare,
  MessageSquareOff,
  Search,
  Star,
  User,
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
  useSetReviewVisibility,
  type AdminReviewRow,
} from '@/lib/hooks/useAdminReviews';
import { useAdminVenues } from '@/lib/hooks/useAdminVenues';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';

export function AdminReviewsScreen() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const [page, setPage] = React.useState(1);
  const [venueFilter, setVenueFilter] = React.useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = React.useState<string>('all');
  const [ratingFilter, setRatingFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Dialog xác nhận ẩn/hiện
  const [confirmTarget, setConfirmTarget] = React.useState<AdminReviewRow | null>(null);
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
    rating: parsedRating,
    q: debouncedSearch.trim() || undefined,
  });

  const toggleVisibility = useSetReviewVisibility();

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reviewsTitle')}
        description={t('reviewsSubtitle')}
      />

      {/* Thanh bộ lọc */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
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
              <div key={i} className="flex items-start gap-4 border-b border-neutral-100 pb-4 last:border-b-0">
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
            (searchQuery || venueFilter || visibilityFilter !== 'all' || ratingFilter !== 'all') ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setVenueFilter('');
                  setVisibilityFilter('all');
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
                  <th scope="col" className="px-4 py-3 min-w-[240px]">{t('colContent')}</th>
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
                                  : 'text-neutral-300 dark:text-neutral-600',
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
                      </div>
                    </td>

                    {/* Cột 4: Trạng thái */}
                    <td className="px-4 py-3 align-top">
                      {row.isVisible ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300">
                          <span className="size-1.5 rounded-full bg-primary-600" />
                          {t('badgePublic')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          <span className="size-1.5 rounded-full bg-neutral-500" />
                          {t('badgeHidden')}
                        </span>
                      )}
                    </td>

                    {/* Cột 5: Thao tác */}
                    <td className="px-4 py-3 align-top text-right">
                      {row.isVisible ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConfirm(row)}
                          className="hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                          aria-label={t('hideReview')}
                        >
                          <EyeOff className="size-4 mr-1 text-neutral-600 group-hover:text-red-700" />
                          <span>{t('hideReview')}</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConfirm(row)}
                          className="hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                          aria-label={t('showReview')}
                        >
                          <Eye className="size-4 mr-1 text-neutral-600 group-hover:text-primary-700" />
                          <span>{t('showReview')}</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="border-t border-neutral-200 p-4">
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
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 space-y-1">
              <div className="font-semibold text-neutral-900">
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
    </div>
  );
}
