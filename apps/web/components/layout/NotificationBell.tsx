'use client';

import * as React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/common/EmptyState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from '@/lib/hooks/useNotifications';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

/** Chuông thông báo ở topbar dashboard: badge chưa đọc + dropdown 8 thông báo gần nhất. */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = React.useState(false);

  const unread = useUnreadCount();
  const list = useNotificationList(8, open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const count = unread.data ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex size-10 items-center justify-center rounded-btn text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          aria-label={count > 0 ? t('ariaWithCount', { count }) : t('title')}
        >
          <Bell className="size-5" aria-hidden="true" />
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-[18px] text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">{t('title')}</p>
          <button
            type="button"
            disabled={count === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            {t('markAll')}
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
          {list.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !list.data || list.data.length === 0 ? (
            <EmptyState icon={Bell} title={t('emptyTitle')} description={t('emptyDesc')} />
          ) : (
            <ul>
              {list.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => !item.readAt && markRead.mutate(item.id)}
                    className={cn(
                      'flex w-full gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-neutral-50',
                      !item.readAt && 'bg-primary-50/50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        item.readAt ? 'bg-transparent' : 'bg-primary-600',
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900">
                        {item.title}
                      </span>
                      {item.body && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-600">
                          {item.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-neutral-500">
                        {timeAgo(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
