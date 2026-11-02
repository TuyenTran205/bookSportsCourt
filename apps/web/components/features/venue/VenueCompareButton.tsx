'use client';

import * as React from 'react';
import { ArrowLeftRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { VenueDetail, VenueListItem } from '@bsc/shared';

import {
  type CompareVenueItem,
  useVenueComparison,
} from '@/lib/hooks/useVenueComparison';
import { cn } from '@/lib/utils/cn';

export interface VenueCompareButtonProps {
  venue: VenueListItem | VenueDetail | CompareVenueItem;
  variant?: 'icon' | 'badge' | 'button';
  showText?: boolean;
  className?: string;
}

export function VenueCompareButton({
  venue,
  variant = 'icon',
  showText = false,
  className,
}: VenueCompareButtonProps) {
  const t = useTranslations('compare');
  const { isInComparison, addVenue, removeVenue } = useVenueComparison();
  const active = isInComparison(venue.id);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (active) {
      removeVenue(venue.id);
    } else {
      addVenue(venue);
    }
  };

  const label = active ? t('btnComparing') : t('btnCompare');

  if (variant === 'button' || showText) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        aria-label={`${label}: ${venue.name}`}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-btn px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
          active
            ? 'border border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950/60 dark:text-primary-300'
            : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800',
          className,
        )}
      >
        {active ? (
          <Check className="size-3.5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        ) : (
          <ArrowLeftRight className="size-3.5" aria-hidden="true" />
        )}
        <span>{label}</span>
      </button>
    );
  }

  // Variant 'icon' hoặc 'badge'
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={`${label}: ${venue.name}`}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
        active
          ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-xs dark:border-primary-700 dark:bg-primary-950/70 dark:text-primary-300'
          : 'border-neutral-200 bg-white/95 text-neutral-600 shadow-xs hover:bg-white hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white',
        className,
      )}
    >
      <ArrowLeftRight
        className={cn(
          'size-4 transition-transform duration-150',
          active ? 'rotate-180 text-primary-700 dark:text-primary-300' : 'text-neutral-600 dark:text-neutral-300',
        )}
        aria-hidden="true"
      />
    </button>
  );
}
