'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/lib/hooks/useTheme';
import { cn } from '@/lib/utils/cn';

export interface ThemeToggleProps {
  className?: string;
  align?: 'start' | 'center' | 'end';
}

/**
 * ThemeToggle – Component chuyển đổi chế độ giao diện (Sáng / Tối / Hệ thống).
 * Chuẩn Anti-AI: 100% Lucide Icons (Sun, Moon, Monitor), không emoji, viền 1px, bo góc rounded-btn.
 */
export function ThemeToggle({ className, align = 'end' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();
  let t = (key: string) => key;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const tIntl = useTranslations('theme');
    t = tIntl;
  } catch {
    // Fallback nếu render ngoài NextIntl
  }

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label={t('toggle')}
        className={cn(
          'inline-flex size-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-btn border border-neutral-200 bg-white text-neutral-600 transition-colors',
          className,
        )}
      >
        <Sun className="size-4 text-amber-500" aria-hidden="true" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('toggle')}
          className={cn(
            'inline-flex size-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-btn border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100',
            className,
          )}
        >
          {resolvedTheme === 'dark' ? (
            <Moon className="size-4 text-neutral-200" aria-hidden="true" />
          ) : (
            <Sun className="size-4 text-amber-500" aria-hidden="true" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-36">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            theme === 'light' && 'font-semibold text-primary-700 dark:text-primary-400',
          )}
        >
          <Sun className="size-4" aria-hidden="true" />
          <span>{t('light')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            theme === 'dark' && 'font-semibold text-primary-700 dark:text-primary-400',
          )}
        >
          <Moon className="size-4" aria-hidden="true" />
          <span>{t('dark')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            theme === 'system' && 'font-semibold text-primary-700 dark:text-primary-400',
          )}
        >
          <Monitor className="size-4" aria-hidden="true" />
          <span>{t('system')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
