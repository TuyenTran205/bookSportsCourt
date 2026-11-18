'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Flag, MessageSquareText, Pencil, Star } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  replyToReview,
  reportReview,
  type OwnerReview,
} from '@/lib/api/endpoints/owner';
import { useOwnerReviews } from '@/lib/hooks/useOwnerReviews';
import { formatDateTimeInVietnam } from '@/lib/utils/format';
import { ReviewReplyDialog } from './ReviewReplyDialog';
import { ReviewReportDialog } from './ReviewReportDialog';

type ReviewTab = 'all' | 'unreplied' | 'replied';
const PAGE_SIZE = 10;

export function ReviewsManagement() {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<ReviewTab>('all');
  const [page, setPage] = React.useState(1);
  const [replyingReview, setReplyingReview] = React.useState<OwnerReview | null>(null);
  const [reportingReview, setReportingReview] = React.useState<OwnerReview | null>(null);
  const replied = activeTab === 'all' ? undefined : activeTab === 'replied';

  const reviewsQuery = useOwnerReviews({ page, limit: PAGE_SIZE, replied });

  const replyMutation = useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) =>
      replyToReview(reviewId, reply),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['owner', 'reviews'] });
      setPage(1);
      setReplyingReview(null);
      toast.success(t('replyReviewSuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('replyReviewFailed'));
    },
  });

  const reportMutation = useMutation({
    mutationFn: ({
      reviewId,
      reason,
      file,
    }: {
      reviewId: string;
      reason: string;
      file?: File | null;
    }) => reportReview(reviewId, { reason, file }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['owner', 'reviews'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      setReportingReview(null);
      toast.success('Đã gửi báo cáo đánh giá lên quản trị viên.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi báo cáo đánh giá.');
    },
  });

  const reviews = reviewsQuery.data?.data ?? [];
  const meta = reviewsQuery.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;

  const changeTab = (tab: ReviewTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <main className="w-full min-w-0 space-y-4 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          {t('reviewsTitle')}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{t('reviewsDesc')}</p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('reviewsTitle')}>
        {([
          ['all', t('reviewsAll')],
          ['unreplied', t('reviewsUnreplied')],
          ['replied', t('reviewsReplied')],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => changeTab(tab)}
            className={`min-h-11 rounded-btn border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 ${
              activeTab === tab
                ? 'border-primary-700 bg-primary-700 text-white'
                : 'border-border bg-bg-card text-text-primary hover:bg-bg-subtle'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {reviewsQuery.isLoading ? (
        <div className="space-y-3" aria-label={t('loadingReviews')}>
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-14 w-full" />
            </Card>
          ))}
        </div>
      ) : reviewsQuery.isError ? (
        <ErrorState error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title={activeTab === 'all' ? t('noReviews') : t('noReviewsForFilter')}
          description={activeTab === 'all' ? t('noReviewsDescription') : t('noReviewsForFilterDescription')}
          action={
            activeTab !== 'all' ? (
              <Button type="button" variant="outline" onClick={() => changeTab('all')}>
                {t('showAllReviews')}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/owner/bookings">{t('bookings')}</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <section className="space-y-3" role="tabpanel" aria-label={t('reviewsTitle')}>
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onReply={() => setReplyingReview(review)}
                onReport={() => setReportingReview(review)}
              />
            ))}
          </section>

          <Pagination
            page={meta?.page ?? page}
            totalPages={totalPages}
            total={total}
            limit={PAGE_SIZE}
            onPageChange={setPage}
            disabled={reviewsQuery.isFetching}
          />
        </>
      )}

      <ReviewReplyDialog
        review={replyingReview}
        saving={replyMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setReplyingReview(null);
        }}
        onSubmit={(reviewId, reply) => replyMutation.mutate({ reviewId, reply })}
      />

      <ReviewReportDialog
        review={reportingReview}
        submitting={reportMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setReportingReview(null);
        }}
        onSubmit={(reviewId, input) =>
          reportMutation.mutate({
            reviewId,
            reason: input.reason,
            file: input.file,
          })
        }
      />
    </main>
  );
}

interface ReviewCardProps {
  review: OwnerReview;
  onReply: () => void;
  onReport: () => void;
}

const REPORT_BADGE: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Đang chờ Admin duyệt báo cáo',
    className:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
  },
  resolved: {
    label: 'Admin đã duyệt ẩn đánh giá',
    className:
      'border-red-300 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300',
  },
  dismissed: {
    label: 'Admin từ chối báo cáo',
    className: 'border-border bg-bg-subtle text-text-secondary',
  },
};

function ReviewCard({ review, onReply, onReport }: ReviewCardProps) {
  const t = useTranslations('owner');
  const customerName = review.customerName ?? review.customer?.fullName ?? t('customer');
  const initial = customerName.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'K';
  const reportStatus = review.reportStatus ?? 'none';
  const reportBadge = REPORT_BADGE[reportStatus];
  const canReport = reportStatus !== 'pending' && reportStatus !== 'resolved';

  return (
    <Card className="space-y-3 p-4 transition-colors hover:border-border sm:p-5">
      <article aria-labelledby={`review-customer-${review.id}`}>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300"
              aria-hidden="true"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={`review-customer-${review.id}`} className="truncate text-sm font-semibold text-text-primary">
                  {customerName}
                </h2>
                {reportBadge && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${reportBadge.className}`}
                  >
                    {reportBadge.label}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {review.venueName ?? t('venueNameUnavailable')}
                {review.courtName ? ` · ${review.courtName}` : ''}
                {' · '}
                <time dateTime={review.createdAt}>{formatDateTimeInVietnam(review.createdAt)}</time>
              </p>
            </div>
          </div>
          <div
            className="flex shrink-0 items-center gap-0.5"
            role="img"
            aria-label={t('ratingOutOfFive', { rating: review.rating })}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                className={`size-4 ${index < review.rating ? 'fill-accent-500 text-accent-600' : 'text-border'}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </header>

        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
          {review.comment || t('reviewNoComment')}
        </p>

        {reportStatus !== 'none' && review.reportReason && (
          <div className="mt-3 rounded-card border border-border bg-bg-subtle p-3 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">Lý do đã báo cáo Admin:</p>
            <p className="mt-1 whitespace-pre-wrap">{review.reportReason}</p>
            {review.reportImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.reportImageUrl}
                alt="Minh chứng báo cáo"
                className="mt-2 max-h-32 rounded border border-border object-contain"
              />
            )}
          </div>
        )}

        {review.ownerReply ? (
          <div className="mt-3 rounded-card border-l-2 border-primary-600 bg-bg-subtle px-3 py-3 sm:ml-7 sm:px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-primary-700 dark:text-primary-400">
                <MessageSquareText className="size-4" aria-hidden="true" />
                {t('ownerReplyAt', {
                  date: review.ownerRepliedAt
                    ? formatDateTimeInVietnam(review.ownerRepliedAt)
                    : t('replyDateUnavailable'),
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {canReport && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-10 px-2 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={onReport}
                  >
                    <Flag className="size-3.5" aria-hidden="true" />
                    Báo cáo đánh giá
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-10 px-2"
                  onClick={onReply}
                >
                  <Pencil aria-hidden="true" />
                  {t('editReply')}
                </Button>
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
              {review.ownerReply}
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {canReport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 text-danger border-danger/40 hover:bg-danger/10 hover:text-danger"
                onClick={onReport}
              >
                <Flag className="size-3.5" aria-hidden="true" />
                Báo cáo đánh giá
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={onReply}
            >
              <MessageSquareText aria-hidden="true" />
              {t('replyBtn')}
            </Button>
          </div>
        )}
      </article>
    </Card>
  );
}
