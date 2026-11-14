'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  Bell,
  BellOff,
  CalendarCheck,
  CheckCheck,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Notification } from '@bsc/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  usePaginatedNotifications,
  useUnreadCount,
} from '@/lib/hooks/useNotifications';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

type FilterTab = 'all' | 'unread' | 'booking' | 'payment' | 'system';

export function NotificationsScreen() {
  const t = useTranslations('notifications');
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<FilterTab>('all');
  const [page, setPage] = React.useState(1);

  const unreadCountQuery = useUnreadCount();
  const unreadCount = unreadCountQuery.data ?? 0;

  const queryParams = React.useMemo(() => {
    return {
      page,
      limit: 10,
      unreadOnly: activeTab === 'unread' ? true : undefined,
      type: activeTab !== 'all' && activeTab !== 'unread' ? activeTab : undefined,
    };
  }, [activeTab, page]);

  const notificationsQuery = usePaginatedNotifications(queryParams);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = notificationsQuery.data?.data ?? [];
  const meta = notificationsQuery.data?.meta;

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success(t('markAllSuccess'));
    } catch {
      toast.error(t('updateFailed'));
    }
  };

  const handleItemClick = (item: Notification) => {
    if (!item.readAt) {
      markRead.mutate(item.id);
    }
    const payload = item.payload as Record<string, unknown> | null;
    if (payload && typeof payload.bookingId === 'string') {
      router.push(`/bookings/${payload.bookingId}`);
    } else if (payload && typeof payload.venueId === 'string') {
      router.push(`/venues/${payload.venueId}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type === 'booking_created' || type === 'booking_confirmed') {
      return (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
          <CalendarCheck className="size-5" />
        </div>
      );
    }
    if (type === 'payment_submitted') {
      return (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <CreditCard className="size-5" />
        </div>
      );
    }
    if (type === 'booking_cancelled' || type === 'hold_expired' || type === 'payment_rejected') {
      return (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <AlertCircle className="size-5" />
        </div>
      );
    }
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-text-secondary">
        <Bell className="size-5" />
      </div>
    );
  };

  const tabs: Array<{ key: FilterTab; label: string }> = [
    { key: 'all', label: t('all') },
    { key: 'unread', label: `${t('unread')} ${unreadCount > 0 ? `(${unreadCount})` : ''}` },
    { key: 'booking', label: t('booking') },
    { key: 'payment', label: t('payment') },
    { key: 'system', label: t('system') },
  ];

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={t('notificationTitle')}
          description={t('notificationSubtitle')}
          className="mb-0"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAll}
          disabled={unreadCount === 0 || markAllRead.isPending}
          className="self-start sm:self-auto"
        >
          {markAllRead.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <CheckCheck className="mr-2 size-4 text-primary-700" />
          )}
          <span>{t('markAllRead')}</span>
        </Button>
      </div>

      {/* Tabs phân loại */}
      <div className="flex border-b border-neutral-200 overflow-x-auto scrollbar-none gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
              activeTab === tab.key
                ? 'border-primary-600 text-primary-800'
                : 'border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-900',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trạng thái tải */}
      {notificationsQuery.isLoading ? (
        <Card className="divide-y divide-neutral-100 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </Card>
      ) : notificationsQuery.isError ? (
        <ErrorState
          error={notificationsQuery.error}
          onRetry={() => notificationsQuery.refetch()}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={t('emptyTitle')}
          description={activeTab === 'all' ? t('emptyDesc') : t('emptyFiltered')}
        />
      ) : (
        <div className="space-y-3">
          <ul className="space-y-2.5" data-testid="notifications-list">
            {notifications.map((item) => {
              const isUnread = !item.readAt;
              return (
                <li key={item.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleItemClick(item);
                      }
                    }}
                    className={cn(
                      'flex items-start gap-3.5 rounded-card border p-4 transition-all duration-150 cursor-pointer text-left',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
                      isUnread
                        ? 'border-primary-200 bg-primary-50/20 shadow-xs hover:border-primary-300 hover:bg-primary-50/30 dark:border-primary-900/50 dark:bg-primary-950/30 dark:hover:bg-primary-950/40'
                        : 'border-border bg-bg-card hover:bg-bg-subtle',
                    )}
                  >
                    {getNotificationIcon(item.type)}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={cn('text-sm font-semibold truncate', isUnread ? 'text-primary-950 dark:text-primary-300' : 'text-text-primary')}>
                          {item.title}
                        </h3>
                        <span className="text-xs text-text-secondary shrink-0">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>

                      {item.body && (
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {item.body}
                        </p>
                      )}
                    </div>

                    {isUnread && (
                      <span
                        className="mt-1 size-2.5 shrink-0 rounded-full bg-primary-600"
                        title={t('unread')}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {meta && (
            <div className="pt-2">
              <Pagination
                meta={meta}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
