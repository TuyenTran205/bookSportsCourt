'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useOwnerReviews } from '@/lib/hooks/useOwnerReviews';
import type { Review } from '@bsc/shared';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils/format';
import { Star } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { ErrorState } from '@/components/common/ErrorState';

export function ReviewsManagement() {
  const t = useTranslations('owner');
  const { role } = useAuth();
  const { data: reviews, isLoading, error, refetch } = useOwnerReviews(role === 'owner');

  if (role !== 'owner') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="h-64">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  const reviewsList: Review[] = reviews?.data ?? [];

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>
          <span className="size-4" aria-hidden="true" />
          {t('reviewsManagement')}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-3 font-medium text-neutral-600">
                {t('customer')}
              </th>
              <th className="text-left py-3 font-medium text-neutral-600">
                {t('rating')}
              </th>
              <th className="text-left py-3 font-medium text-neutral-600">
                {t('comment')}
              </th>
              <th className="text-left py-3 font-medium text-neutral-600">
                {t('createdAt')}
              </th>
              <th className="text-left py-3 font-medium text-neutral-600">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {reviewsList.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-500">
                  {t('noReviews')}
                </td>
              </tr>
            ) : (
              reviewsList.map((review) => (
                  <tr key={review.id} className="border-b">
                    <td className="py-3">
                      {review.customer?.fullName || review.customerId?.substring(0, 8) || '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        <Star className="size-4 fill-yellow-400 text-yellow-400" />
                        <span>{review.rating}</span>
                      </div>
                    </td>
                    <td className="py-3 max-w-xs truncate">
                      {review.comment || '—'}
                    </td>
                    <td className="py-3">
                      {formatDateTime(review.createdAt)}
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement reply to review
                        }}
                      >
                        {review.ownerReply ? t('viewReply') : t('reply')}
                      </Button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}