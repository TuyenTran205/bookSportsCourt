'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { RealtimeEvent } from '@/mocks/realtime';
import { useRealtime } from './useSocket';

export interface UseOwnerRealtimeOptions {
  venueId?: string;
  enabled?: boolean;
  notifyOnBookingCreated?: boolean;
  notifyOnPaymentSubmitted?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
}

/**
 * useOwnerRealtime – Lắng nghe các sự kiện realtime dành cho phân hệ Chủ sân.
 * Tự động đồng bộ cache TanStack Query (Timeline, Bookings, Payments)
 * và hiển thị toast thông báo trạng thái tức thì.
 */
export function useOwnerRealtime(options: UseOwnerRealtimeOptions = {}): void {
  const {
    venueId,
    enabled = true,
    notifyOnBookingCreated = true,
    notifyOnPaymentSubmitted = true,
    onEvent,
  } = options;

  const queryClient = useQueryClient();

  const handleEvent = React.useCallback(
    (event: RealtimeEvent) => {
      if (!enabled) return;

      switch (event.type) {
        case 'booking_created': {
          if (venueId && event.payload.venueId !== venueId) {
            return;
          }
          void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
          void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
          void queryClient.invalidateQueries({ queryKey: ['owner', 'payments'] });
          if (notifyOnBookingCreated) {
            toast.info(`Có đơn đặt sân mới #${event.payload.bookingId.slice(0, 8)}`, {
              description: 'Dữ liệu lịch sân đã được đồng bộ',
            });
          }
          break;
        }

        case 'payment_submitted': {
          if (venueId && event.payload.venueId !== venueId) {
            return;
          }
          void queryClient.invalidateQueries({ queryKey: ['owner', 'payments'] });
          void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
          if (notifyOnPaymentSubmitted) {
            toast.info(`Khách vừa tải ảnh thanh toán cho đơn #${event.payload.bookingId.slice(0, 8)}`);
          }
          break;
        }

        case 'slot_updated': {
          if (venueId && event.payload.venueId !== venueId) {
            return;
          }
          void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
          void queryClient.invalidateQueries({ queryKey: ['venues'] });
          break;
        }

        case 'booking_confirmed': {
          void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
          void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
          toast.success(`Đơn đặt sân #${event.payload.bookingId.slice(0, 8)} đã được xác nhận`);
          break;
        }

        case 'booking_cancelled': {
          void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
          void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
          toast.warning(`Đơn đặt sân #${event.payload.bookingId.slice(0, 8)} đã bị huỷ`, {
            description: event.payload.reason,
          });
          break;
        }

        case 'hold_expired': {
          void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
          void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
          break;
        }

        default:
          break;
      }

      onEvent?.(event);
    },
    [
      enabled,
      venueId,
      notifyOnBookingCreated,
      notifyOnPaymentSubmitted,
      queryClient,
      onEvent,
    ],
  );

  useRealtime(handleEvent);
}
