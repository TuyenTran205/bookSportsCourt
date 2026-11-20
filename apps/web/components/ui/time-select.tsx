'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface TimeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  stepMinutes?: number;
  include24?: boolean;
}

export const TimeSelect = React.forwardRef<HTMLSelectElement, TimeSelectProps>(
  ({ className, value, onChange, stepMinutes = 30, include24 = true, disabled, ...props }, ref) => {
    const options = React.useMemo(() => {
      const count = (24 * 60) / stepMinutes + (include24 ? 1 : 0);
      const list = Array.from({ length: count }, (_, i) => {
        const totalMinutes = i * stepMinutes;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      });
      if (value && !list.includes(value)) {
        list.push(value);
        list.sort();
      }
      return list;
    }, [stepMinutes, include24, value]);

    return (
      <select
        ref={ref}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full rounded-input border border-border bg-bg-card px-3 py-2 text-sm text-text-primary font-mono tabular-nums',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:border-primary-600',
          'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-text-disabled',
          className
        )}
        {...props}
      >
        {options.map((timeStr) => (
          <option key={timeStr} value={timeStr}>
            {timeStr}
          </option>
        ))}
      </select>
    );
  }
);

TimeSelect.displayName = 'TimeSelect';
