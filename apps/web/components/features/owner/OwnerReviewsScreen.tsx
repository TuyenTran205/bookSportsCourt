'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CornerDownRight, Edit3, MessageSquare, Star } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { ReviewReplyDialog } from '@/components/features/owner/ReviewReplyDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOwnerReviews,
  type OwnerReviewItem,
} from '@/lib/hooks/useOwnerReviews';
import { formatDateTime } from '@/lib/utils/format';

export function OwnerReviewsScreen() {
  const t = useTranslations('owner');

  const [page, setPage] = React.useState(1);
  const [repliedFilter, setRepliedFilter] = React.useState<boolean | undefined>(undefined);
  const [selectedReview, setSelectedReview] = React.useState<OwnerReviewItem | null>(null);

  const reviewsQuery = useOwnerReviews({
    page,
    limit: 10,
    replied: repliedFilter,
  });

  const reviews = reviewsQuery.data?.data ?? [];
  const meta = reviewsQuery.data?.meta;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('reviewsTitle')} description={t('reviewsDesc')} />

      {/* Bộ lọc trạng thái phản hồi */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant={repliedFilter === undefined ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setRepliedFilter(undefined);
            setPage(1);
          }}
        >
          Tất cả
        </Button>
        <Button
          variant={repliedFilter === false ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setRepliedFilter(false);
            setPage(1);
          }}
        >
          Chưa phản hồi
        </Button>
        <Button
          variant={repliedFilter === true ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setRepliedFilter(true);
            setPage(1);
          }}
        >
          Đã phản hồi
        </Button>
      </div>

      {reviewsQuery.isPending ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-card" />
          ))}
        </div>
      ) : reviewsQuery.isError ? (
        <ErrorState
          error={reviewsQuery.error}
          onRetry={() => void reviewsQuery.refetch()}
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t('noReviews')}
          description="Chưa có đánh giá nào của khách hàng khớp với bộ lọc hiện tại."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => {
            const customerName =
              review.customerName ?? review.customer?.fullName ?? 'Khách hàng';

            return (
              <Card key={review.id} className="p-5 transition-shadow hover:shadow-sm">
                <div className="flex flex-col gap-3">
                  {/* Khách hàng + sao + thời gian */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">
                        {customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900">{customerName}</p>
                        <p className="text-xs text-neutral-500">
                          {review.venueName ? `${review.venueName} · ` : ''}
                          {formatDateTime(review.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`size-4 ${
                            i < review.rating
                              ? 'fill-amber-500'
                              : 'fill-neutral-200 text-neutral-200'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Nội dung nhận xét */}
                  <div className="pl-13 text-sm text-neutral-800">
                    <p>{review.comment || <span className="italic text-neutral-400">Khách không để lại lời nhận xét</span>}</p>
                  </div>

                  {/* Khối phản hồi của chủ sân (nếu có) */}
                  {review.ownerReply ? (
                    <div className="ml-6 mt-1 rounded-card border-l-2 border-primary-600 bg-neutral-50 p-3.5 sm:ml-12">
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span className="flex items-center gap-1.5 font-semibold text-primary-700">
                          <CornerDownRight className="size-3.5" aria-hidden="true" />
                          Phản hồi của bạn
                          {review.ownerRepliedAt ? ` · ${formatDateTime(review.ownerRepliedAt)}` : ''}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-neutral-600"
                          onClick={() => setSelectedReview(review)}
                        >
                          <Edit3 className="mr-1 size-3" aria-hidden="true" />
                          Sửa
                        </Button>
                      </div>
                      <p className="mt-1.5 text-xs text-neutral-700">{review.ownerReply}</p>
                    </div>
                  ) : (
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReview(review)}
                      >
                        <MessageSquare className="mr-1.5 size-3.5" aria-hidden="true" />
                        {t('replyReview')}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {meta && (
            <Pagination
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      <ReviewReplyDialog
        review={selectedReview}
        open={selectedReview !== null}
        onClose={() => setSelectedReview(null)}
      />
    </div>
  );
}
