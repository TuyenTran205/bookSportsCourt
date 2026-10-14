'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarClock, MapPin, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ErrorState } from '@/components/common/ErrorState';
import { PaymentPanel } from '@/components/features/booking/PaymentPanel';
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
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/errors';
import {
  bookingKeys,
  useBookingDetail,
  useCancelBooking,
  useCreateReview,
  useHoldInfo,
} from '@/lib/hooks/useBookings';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatDateWithWeekday, formatDateTime, formatTimeRange } from '@/lib/utils/format';
import { useQueryClient } from '@tanstack/react-query';

/** BookingDetailScreen – CUS-08..CUS-12: thanh toán, theo dõi, huỷ và đánh giá một đơn. */
export function BookingDetailScreen() {
  const t = useTranslations('bookingDetail');
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const query = useBookingDetail(id);
  const booking = query.data;

  const needsPayment = booking?.status === 'held';
  const hold = useHoldInfo(id, needsPayment);

  const [cancelOpen, setCancelOpen] = React.useState(false);

  if (query.isLoading) {
    return (
      <main className="container max-w-3xl space-y-4 py-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (query.isError || !booking) {
    return (
      <main className="container max-w-3xl py-8">
        <ErrorState error={query.error ?? t('notFound')} onRetry={() => query.refetch()} />
      </main>
    );
  }

  const { court, payment } = booking;
  const canCancel = booking.status === 'held' || booking.status === 'pending_payment' || booking.status === 'confirmed';
  const canReview = booking.status === 'completed' && !booking.review;

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <nav aria-label="breadcrumb" className="text-sm text-neutral-600">
        <Link href="/bookings" className="hover:text-primary-700 hover:underline">
          {t('myBookings')}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-neutral-900">{court.venue.name}</span>
      </nav>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-neutral-900">{court.venue.name}</h1>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-neutral-600">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {court.venue.address}
            </p>
          </div>
          <StatusBadge kind="booking" status={booking.status} />
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label={t('court')} value={court.name} />
          <Info
            label={t('time')}
            value={`${formatTimeRange(booking.during.start, booking.during.end)} · ${formatDateWithWeekday(booking.during.start)}`}
            icon
          />
          <Info label={t('total')} value={formatCurrency(booking.totalPrice)} />
          <Info label={t('deposit')} value={formatCurrency(booking.depositAmount)} />
          {payment && <Info label={t('paymentStatus')} value={<StatusBadge kind="payment" status={payment.status} size="sm" />} />}
          <Info label={t('createdAt')} value={formatDateTime(booking.createdAt)} />
        </dl>

        {booking.status === 'cancelled' && (
          <p className="rounded-btn bg-neutral-50 p-3 text-sm text-neutral-700">
            {t('cancelledNote', { reason: booking.cancelReason ?? '—' })}
            {payment?.refundAmount ? ` ${t('refunded', { amount: formatCurrency(payment.refundAmount) })}` : ''}
          </p>
        )}
        {payment?.status === 'rejected' && payment.rejectReason && (
          <p role="alert" className="rounded-btn border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {t('rejectedNote', { reason: payment.rejectReason })}
          </p>
        )}
        {booking.status === 'pending_payment' && (
          <p className="rounded-btn bg-warning/10 p-3 text-sm text-neutral-800">{t('waitingReview')}</p>
        )}
      </Card>

      {needsPayment &&
        (hold.data ? (
          <PaymentPanel
            bookingId={booking.id}
            payment={hold.data.payment}
            expiresAt={booking.expiresAt}
            onExpired={() => void queryClient.invalidateQueries({ queryKey: bookingKeys.all })}
          />
        ) : (
          <Skeleton className="h-96 w-full" />
        ))}

      {booking.review && (
        <Card className="space-y-2 p-5">
          <h2 className="text-lg font-semibold text-neutral-900">{t('yourReview')}</h2>
          <Stars value={booking.review.rating} />
          {booking.review.comment && <p className="text-sm text-neutral-700">{booking.review.comment}</p>}
          {booking.review.ownerReply && (
            <div className="rounded-btn bg-neutral-50 p-3 text-sm">
              <p className="mb-0.5 text-xs font-semibold text-neutral-600">{t('ownerReply')}</p>
              <p className="text-neutral-700">{booking.review.ownerReply}</p>
            </div>
          )}
        </Card>
      )}

      {canReview && <ReviewForm bookingId={booking.id} />}

      {canCancel && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setCancelOpen(true)}>
            {t('cancel')}
          </Button>
        </div>
      )}

      <CancelDialog
        bookingId={booking.id}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        policy={
          booking.status === 'confirmed'
            ? t('cancelPolicyConfirmed')
            : t('cancelPolicyUnpaid')
        }
      />
    </main>
  );
}

function Info({ label, value, icon }: { label: string; value: React.ReactNode; icon?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-neutral-900">
        {icon && <CalendarClock className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />}
        {value}
      </dd>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <p className="flex items-center gap-0.5" aria-label={`${value}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('size-5', i < value ? 'fill-amber-400 text-amber-400' : 'text-neutral-300')}
          aria-hidden="true"
        />
      ))}
    </p>
  );
}

function CancelDialog({
  bookingId,
  open,
  onOpenChange,
  policy,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: string;
}) {
  const t = useTranslations('bookingDetail');
  const cancel = useCancelBooking();
  const [reason, setReason] = React.useState('');

  const onConfirm = async () => {
    try {
      await cancel.mutateAsync({ id: bookingId, reason: reason.trim() || undefined });
      toast.success(t('cancelDone'));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('cancelFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancelTitle')}</DialogTitle>
          <DialogDescription>{policy}</DialogDescription>
        </DialogHeader>
        <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-medium text-neutral-800">
          {t('cancelReason')}
        </label>
        <Textarea
          id="cancel-reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('keep')}
          </Button>
          <Button variant="danger" loading={cancel.isPending} onClick={onConfirm}>
            {t('confirmCancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations('bookingDetail');
  const create = useCreateReview();
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('pickRating'));
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({ bookingId, rating, comment: comment.trim() || undefined });
      toast.success(t('reviewDone'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('reviewFailed'));
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <h2 className="text-lg font-semibold text-neutral-900">{t('writeReview')}</h2>
        <div role="radiogroup" aria-label={t('rating')} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n}/5`}
              onClick={() => setRating(n)}
              className="rounded-btn p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <Star
                className={cn('size-7', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300')}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Textarea
          aria-label={t('comment')}
          placeholder={t('commentPlaceholder')}
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <Button type="submit" variant="primary" loading={create.isPending}>
          {t('sendReview')}
        </Button>
      </form>
    </Card>
  );
}
