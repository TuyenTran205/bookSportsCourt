'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Clock } from 'lucide-react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import {
  useOwnerOpeningHours,
  useUpdateOpeningHours,
} from '@/lib/hooks/useOwnerPricing';

const WEEKDAYS = [
  { weekday: 1, label: 'Thứ hai' },
  { weekday: 2, label: 'Thứ ba' },
  { weekday: 3, label: 'Thứ tư' },
  { weekday: 4, label: 'Thứ năm' },
  { weekday: 5, label: 'Thứ sáu' },
  { weekday: 6, label: 'Thứ bảy' },
  { weekday: 0, label: 'Chủ nhật' },
];

interface WeekdayRow {
  weekday: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  courtId: string | null;
}

export interface OpeningHoursTabProps {
  venueId: string;
}

export function OpeningHoursTab({ venueId }: OpeningHoursTabProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const { data: remoteHours, isPending, isError, error, refetch } = useOwnerOpeningHours(venueId);
  const updateMutation = useUpdateOpeningHours();

  const [rows, setRows] = React.useState<WeekdayRow[]>([]);

  React.useEffect(() => {
    // Khởi tạo 7 ngày mặc định nếu chưa có
    const initialRows: WeekdayRow[] = WEEKDAYS.map(({ weekday }) => {
      const match = remoteHours?.find((h) => h.weekday === weekday && !h.courtId);
      return {
        weekday,
        openTime: match?.openTime ?? '06:00',
        closeTime: match?.closeTime ?? '22:00',
        isClosed: match?.isClosed ?? false,
        courtId: null,
      };
    });
    setRows(initialRows);
  }, [remoteHours]);

  const handleChange = (
    weekday: number,
    field: 'openTime' | 'closeTime' | 'isClosed',
    val: string | boolean,
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.weekday === weekday ? { ...r, [field]: val } : r)),
    );
  };

  const handleSave = async () => {
    // Validate giờ mở < giờ đóng nếu không đóng cửa
    for (const r of rows) {
      if (!r.isClosed && r.openTime >= r.closeTime) {
        const dayLabel = WEEKDAYS.find((w) => w.weekday === r.weekday)?.label ?? '';
        toast.error(`${dayLabel}: Giờ đóng cửa phải sau giờ mở cửa`);
        return;
      }
    }

    try {
      await updateMutation.mutateAsync({
        venueId,
        hours: rows.map((r) => ({
          weekday: r.weekday,
          openTime: r.openTime,
          closeTime: r.closeTime,
          isClosed: r.isClosed,
          courtId: null,
        })),
      });
      toast.success(t('saveOpeningHoursSuccess'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  if (isPending) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-card" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              Khung giờ mở cửa hàng tuần
            </h3>
            <p className="text-xs text-neutral-500">
              Áp dụng cho toàn bộ các sân trong cơ sở. Slot đặt sân sẽ tự động sinh theo khung giờ này.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            size="sm"
          >
            <Check className="mr-1.5 size-4" aria-hidden="true" />
            {updateMutation.isPending ? tCommon('loading') : t('saveOpeningHours')}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase text-neutral-500">
                <th className="py-3 pr-4">Thứ trong tuần</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Giờ mở cửa</th>
                <th className="py-3 pl-4">Giờ đóng cửa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {WEEKDAYS.map(({ weekday, label }) => {
                const row = rows.find((r) => r.weekday === weekday);
                if (!row) return null;

                return (
                  <tr key={weekday} className="hover:bg-neutral-50/50">
                    <td className="py-3.5 pr-4 font-medium text-neutral-900">{label}</td>
                    <td className="py-3.5 px-4">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.isClosed}
                          onChange={(e) => handleChange(weekday, 'isClosed', e.target.checked)}
                          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className={row.isClosed ? 'font-semibold text-danger' : 'text-neutral-600'}>
                          {row.isClosed ? 'Đóng cửa cả ngày' : 'Mở cửa'}
                        </span>
                      </label>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="relative w-36">
                        <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                          type="time"
                          value={row.openTime}
                          disabled={row.isClosed}
                          onChange={(e) => handleChange(weekday, 'openTime', e.target.value)}
                          className="h-9 pl-9 text-xs"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 pl-4">
                      <div className="relative w-36">
                        <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                          type="time"
                          value={row.closeTime}
                          disabled={row.isClosed}
                          onChange={(e) => handleChange(weekday, 'closeTime', e.target.value)}
                          className="h-9 pl-9 text-xs"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
