import * as React from 'react';
import { Clock } from 'lucide-react';
import type { OpeningHour } from '@bsc/shared';
import { cn } from '@/lib/utils/cn';

export interface VenueOpeningHoursProps {
  openingHours?: OpeningHour[] | null;
  className?: string;
}

const WEEKDAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  0: 'Chủ Nhật',
};

export function VenueOpeningHours({ openingHours, className }: VenueOpeningHoursProps) {
  const currentWeekday = new Date().getDay();

  // Gom các bản ghi theo weekday (chỉ lấy courtId === null hoặc bản ghi đầu tiên của thứ đó)
  const hoursByWeekday = React.useMemo(() => {
    const map = new Map<number, OpeningHour>();
    if (!openingHours || !Array.isArray(openingHours)) return map;

    for (const item of openingHours) {
      // Ưu tiên bản ghi áp dụng cho toàn bộ venue (courtId === null)
      if (!map.has(item.weekday) || item.courtId === null) {
        map.set(item.weekday, item);
      }
    }
    return map;
  }, [openingHours]);

  const hasData = hoursByWeekday.size > 0;

  return (
    <section aria-labelledby="opening-hours-heading" className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Clock className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
        <h2 id="opening-hours-heading" className="text-xl font-semibold text-neutral-900">
          Giờ hoạt động
        </h2>
      </div>

      <div className="rounded-card border border-neutral-200 bg-white p-4 shadow-sm">
        {!hasData ? (
          <div className="flex items-center gap-2 py-2 text-sm text-neutral-500">
            <Clock className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <span>Đang cập nhật giờ mở cửa</span>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {WEEKDAYS_ORDER.map((weekday) => {
              const item = hoursByWeekday.get(weekday);
              const isToday = weekday === currentWeekday;
              const name = WEEKDAY_NAMES[weekday];

              return (
                <li
                  key={weekday}
                  data-testid={`opening-hour-row-${weekday}`}
                  className={cn(
                    'flex items-center justify-between py-2.5 px-3 transition-colors',
                    isToday &&
                      'rounded-md border border-primary-300 bg-primary-50/50 font-semibold text-primary-900 shadow-xs',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium', isToday ? 'text-primary-900' : 'text-neutral-800')}>
                      {name}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-medium text-white">
                        Hôm nay
                      </span>
                    )}
                  </div>

                  <div>
                    {!item || item.isClosed ? (
                      <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        Đóng cửa
                      </span>
                    ) : (
                      <span className={cn('font-mono text-sm', isToday ? 'text-primary-950' : 'text-neutral-700')}>
                        {item.openTime} – {item.closeTime}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
