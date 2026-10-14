'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Ban, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { BlackoutDialog } from '@/components/features/owner/BlackoutDialog';
import {
  ManualBookingDialog,
  type ManualBookingRange,
} from '@/components/features/owner/ManualBookingDialog';
import { OwnerTimeline } from '@/components/features/owner/OwnerTimeline';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import { useDeleteBlackout } from '@/lib/hooks/useOwnerMutations';
import { useOwnerTimeline, useOwnerVenues } from '@/lib/hooks/useOwnerTimeline';
import { addDays, formatDateWithWeekday, toDateInputValue } from '@/lib/utils/format';

/**
 * OwnerTimelineScreen – màn "Lịch sân theo ngày" của chủ sân (OWN-06).
 *
 * `OwnerTimeline` chỉ là phần vẽ lưới, nhận dữ liệu qua props. Component này
 * lo phần còn lại: chọn cơ sở, chuyển ngày, và ba trạng thái tải/lỗi/rỗng.
 *
 * Tách đôi như vậy để lưới vẫn thuần hiển thị — test được bằng props, không
 * phải dựng mạng giả.
 */
export function OwnerTimelineScreen() {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const [venueId, setVenueId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(() => toDateInputValue(new Date()));
  const [manualRange, setManualRange] = React.useState<ManualBookingRange | null>(null);
  const [blackoutOpen, setBlackoutOpen] = React.useState(false);

  const deleteBlackoutMutation = useDeleteBlackout();

  const handleDeleteBlackout = async (courtId: string, blackoutId: string) => {
    try {
      await deleteBlackoutMutation.mutateAsync({ courtId, blackoutId });
      toast.success(t('unlockSuccess'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('unlockFailed'));
    }
  };

  const venuesQuery = useOwnerVenues();
  const venues = React.useMemo(() => venuesQuery.data ?? [], [venuesQuery.data]);

  // Chọn cơ sở đầu tiên sau khi danh sách về. Không đặt làm giá trị khởi tạo
  // vì danh sách đến bất đồng bộ — lúc mount ta chưa biết cơ sở nào.
  React.useEffect(() => {
    const first = venues[0];
    if (venueId === null && first) setVenueId(first.id);
  }, [venueId, venues]);

  const timelineQuery = useOwnerTimeline(venueId, date);

  const today = toDateInputValue(new Date());
  const isToday = date === today;

  const header = (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-neutral-900">{t('timelineTitle')}</h1>
        <p className="text-sm text-neutral-500">{t('timelineHint')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {/* Chọn cơ sở — lưới vẽ giờ mở cửa theo cơ sở nên phải chọn được. */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-timeline-venue">{t('selectVenue')}</Label>
          <select
            id="owner-timeline-venue"
            className="h-10 rounded-btn border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-neutral-50"
            value={venueId ?? ''}
            disabled={venuesQuery.isPending || venues.length === 0}
            onChange={(event) => setVenueId(event.target.value)}
          >
            {venues.length === 0 && <option value="">{tCommon('emptyTitle')}</option>}
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={t('prevDay')}
            onClick={() => setDate((d) => addDays(d, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>

          <div className="flex flex-col gap-1">
            <Label htmlFor="owner-timeline-date">{t('selectDate')}</Label>
            <input
              id="owner-timeline-date"
              type="date"
              className="h-10 rounded-btn border border-neutral-300 bg-white px-3 text-sm tabular-nums text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              value={date}
              onChange={(event) => {
                // Ô ngày trống khi người dùng đang gõ dở — giữ nguyên ngày cũ
                // thay vì ghi chuỗi rỗng vào state.
                if (event.target.value) setDate(event.target.value);
              }}
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label={t('nextDay')}
            onClick={() => setDate((d) => addDays(d, 1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>

          <Button variant="ghost" disabled={isToday} onClick={() => setDate(today)}>
            <CalendarDays aria-hidden="true" />
            {t('today')}
          </Button>

          <Button
            variant="outline"
            onClick={() => setBlackoutOpen(true)}
            disabled={venuesQuery.isPending || venues.length === 0}
          >
            <Ban className="size-4" aria-hidden="true" />
            {t('blackout')}
          </Button>
        </div>
      </div>
    </header>
  );

  const body = renderBody();

  return (
    <div className="flex flex-col gap-4">
      {header}
      {body}
      <ManualBookingDialog range={manualRange} onClose={() => setManualRange(null)} />
      <BlackoutDialog
        open={blackoutOpen}
        onClose={() => setBlackoutOpen(false)}
        courts={timelineQuery.data?.courts ?? []}
        currentDate={date}
        blackouts={timelineQuery.data?.blackouts ?? []}
        onDeleteBlackout={handleDeleteBlackout}
      />
    </div>
  );

  function renderBody() {
    // Danh sách cơ sở là điều kiện tiên quyết: chưa có nó thì chưa gọi được
    // timeline, nên hai trạng thái này phải xét trước.
    if (venuesQuery.isPending) return <TimelineSkeleton />;

    if (venuesQuery.isError) {
      return <ErrorState error={venuesQuery.error} onRetry={() => void venuesQuery.refetch()} />;
    }

    if (venues.length === 0) {
      return (
        <EmptyState
          icon={LayoutGrid}
          title={t('timelineNoCourts')}
          description={t('timelineNoCourtsDesc')}
        />
      );
    }

    // `venueId` được effect ở trên gán sau khi danh sách về, nên có một nhịp
    // render chưa kịp có id — hiện khung chờ thay vì lưới rỗng.
    if (venueId === null || timelineQuery.isPending) return <TimelineSkeleton />;

    if (timelineQuery.isError) {
      return <ErrorState error={timelineQuery.error} onRetry={() => void timelineQuery.refetch()} />;
    }

    const day = timelineQuery.data;

    return (
      <>
        {/* Ngày đang xem, viết rõ ra chữ — ô `<input type="date">` chỉ hiện số. */}
        <p className="text-sm font-medium text-neutral-700">
          {formatDateWithWeekday(`${day.date}T12:00:00+07:00`)}
        </p>

        <OwnerTimeline
          date={day.date}
          courts={day.courts}
          openingHours={day.openingHours}
          bookings={day.bookings}
          blackouts={day.blackouts}
          onDeleteBlackout={handleDeleteBlackout}
          onCreateBooking={({ courtId, start, end }) =>
            setManualRange({
              courtId,
              courtName: day.courts.find((c) => c.id === courtId)?.name ?? '',
              start,
              end,
            })
          }
        />
      </>
    );
  }
}

/** Khung chờ — giữ đúng chiều cao lưới để bố cục không nhảy khi dữ liệu về. */
function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-neutral-200 bg-white p-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
