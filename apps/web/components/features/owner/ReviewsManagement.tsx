'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, MessageSquareText, Pencil, Star } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { replyToReview, type OwnerReview } from '@/lib/api/endpoints/owner';
import { useOwnerReviews } from '@/lib/hooks/useOwnerReviews';
import { formatDateTimeInVietnam } from '@/lib/utils/format';
import { ReviewReplyDialog } from './ReviewReplyDialog';

type ReviewTab = 'all' | 'unreplied' | 'replied';
const PAGE_SIZE = 10;

export function ReviewsManagement() {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<ReviewTab>('all');
  const [page, setPage] = React.useState(1);
  const [replyingReview, setReplyingReview] = React.useState<OwnerReview | null>(null);
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
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {t('reviewsTitle')}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">{t('reviewsDesc')}</p>
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
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100'
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
              />
            ))}
          </section>

          <footer className="flex flex-col gap-3 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite">
              {t('reviewsPaginationRange', {
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, total),
                total,
              })}
            </p>
            <nav className="flex items-center justify-between gap-2 sm:justify-end" aria-label={t('reviewsPagination')}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('previousPage')}
                disabled={page <= 1 || reviewsQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="min-w-16 text-center tabular-nums">
                {t('pageOf', { page: meta?.page ?? page, totalPages })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('nextPage')}
                disabled={page >= totalPages || reviewsQuery.isFetching}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          </footer>
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
    </main>
  );
}

interface ReviewCardProps {
  review: OwnerReview;
  onReply: () => void;
}

function ReviewCard({ review, onReply }: ReviewCardProps) {
  const t = useTranslations('owner');
  const customerName = review.customerName ?? review.customer?.fullName ?? t('customer');
  const initial = customerName.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'K';

  return (
    <Card className="space-y-3 p-4 transition-colors hover:border-neutral-300 sm:p-5">
      <article aria-labelledby={`review-customer-${review.id}`}>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
              aria-hidden="true"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <h2 id={`review-customer-${review.id}`} className="truncate text-sm font-semibold text-neutral-900">
                {customerName}
              </h2>
              <p className="mt-0.5 truncate text-xs text-neutral-500">
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
                className={`size-4 ${index < review.rating ? 'fill-accent-500 text-accent-600' : 'text-neutral-300'}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </header>

        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700">
          {review.comment || t('reviewNoComment')}
        </p>

        {review.ownerReply ? (
          <div className="mt-3 rounded-card border-l-2 border-primary-600 bg-neutral-50 px-3 py-3 sm:ml-7 sm:px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-primary-700">
                <MessageSquareText className="size-4" aria-hidden="true" />
                {t('ownerReplyAt', {
                  date: review.ownerRepliedAt
                    ? formatDateTimeInVietnam(review.ownerRepliedAt)
                    : t('replyDateUnavailable'),
                })}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 self-start px-2 sm:self-auto"
                onClick={onReply}
              >
                <Pencil aria-hidden="true" />
                {t('editReply')}
              </Button>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700">
              {review.ownerReply}
            </p>
          </div>
        ) : (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
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
