// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useOwnerRealtime } from './useOwnerRealtime';
import type { RealtimeEvent } from './useSocket';

const mocks = vi.hoisted(() => {
  let listener: ((event: RealtimeEvent) => void) | null = null;
  return {
    invalidateQueriesMock: vi.fn(),
    toastMock: {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
    unsubscribeMock: vi.fn(),
    getListener: () => listener,
    setListener: (l: ((event: RealtimeEvent) => void) | null) => {
      listener = l;
    },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueriesMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: mocks.toastMock,
}));

vi.mock('./useSocket', () => ({
  useRealtime: (listener: (event: RealtimeEvent) => void) => {
    mocks.setListener(listener);
    React.useEffect(() => {
      return () => {
        mocks.unsubscribeMock();
      };
    }, []);
  },
}));

describe('useOwnerRealtime hook (SPEC-FE-BATCH3-01 / TODO-10)', () => {
  beforeEach(() => {
    mocks.invalidateQueriesMock.mockClear();
    mocks.toastMock.info.mockClear();
    mocks.toastMock.success.mockClear();
    mocks.toastMock.warning.mockClear();
    mocks.toastMock.error.mockClear();
    mocks.unsubscribeMock.mockClear();
    mocks.setListener(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-RT-01: Invalidate queries và Toast khi nhận sự kiện booking_created', () => {
    renderHook(() => useOwnerRealtime({ venueId: 'v-1' }));
    const currentListener = mocks.getListener();
    expect(currentListener).toBeTypeOf('function');

    act(() => {
      currentListener?.({
        type: 'booking_created',
        payload: {
          bookingId: 'b-999-booking-long-id',
          venueId: 'v-1',
          courtId: 'c-1',
        },
      });
    });

    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'bookings'] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'timeline'] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'payments'] });

    expect(mocks.toastMock.info).toHaveBeenCalledWith(
      expect.stringContaining('b-999-bo'),
      expect.objectContaining({
        description: 'Dữ liệu lịch sân đã được đồng bộ',
      }),
    );
  });

  it('TC-RT-02: Bỏ qua sự kiện không khớp venueId cấu hình', () => {
    renderHook(() => useOwnerRealtime({ venueId: 'v-1' }));
    const currentListener = mocks.getListener();

    act(() => {
      currentListener?.({
        type: 'slot_updated',
        payload: {
          venueId: 'v-2',
          courtId: 'c-2',
          date: '2026-11-02',
          slots: [
            {
              start: '2026-11-02T08:00:00+07:00',
              end: '2026-11-02T08:30:00+07:00',
              status: 'held',
              price: 100000,
            },
          ],
        },
      });
    });

    expect(mocks.invalidateQueriesMock).not.toHaveBeenCalled();
    expect(mocks.toastMock.info).not.toHaveBeenCalled();
  });

  it('TC-RT-03: Invalidate query khi có minh chứng thanh toán (payment_submitted)', () => {
    renderHook(() => useOwnerRealtime({ venueId: 'v-1' }));
    const currentListener = mocks.getListener();

    act(() => {
      currentListener?.({
        type: 'payment_submitted',
        payload: {
          paymentId: 'p-1',
          bookingId: 'b-777-payment-id',
          venueId: 'v-1',
        },
      });
    });

    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'payments'] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'bookings'] });
    expect(mocks.toastMock.info).toHaveBeenCalledWith(expect.stringContaining('b-777-pa'));
  });

  it('TC-RT-04: Dọn dẹp listener khi unmount hook', () => {
    const { unmount } = renderHook(() => useOwnerRealtime({ venueId: 'v-1' }));

    unmount();
    expect(mocks.unsubscribeMock).toHaveBeenCalled();
  });

  it('xử lý sự kiện booking_confirmed: invalidate và toast.success', () => {
    renderHook(() => useOwnerRealtime({ venueId: 'v-1' }));
    const currentListener = mocks.getListener();

    act(() => {
      currentListener?.({
        type: 'booking_confirmed',
        payload: {
          bookingId: 'b-888-confirmed',
        },
      } as RealtimeEvent);
    });

    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'bookings'] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'timeline'] });
    expect(mocks.toastMock.success).toHaveBeenCalledWith(expect.stringContaining('b-888-co'));
  });

  it('xử lý sự kiện booking_cancelled: invalidate và toast.warning', () => {
    renderHook(() => useOwnerRealtime({ venueId: 'v-1' }));
    const currentListener = mocks.getListener();

    act(() => {
      currentListener?.({
        type: 'booking_cancelled',
        payload: {
          bookingId: 'b-555-cancelled',
          reason: 'Khách hàng bận đột xuất',
        },
      } as RealtimeEvent);
    });

    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'bookings'] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'timeline'] });
    expect(mocks.toastMock.warning).toHaveBeenCalledWith(
      expect.stringContaining('b-555-ca'),
      expect.objectContaining({ description: 'Khách hàng bận đột xuất' }),
    );
  });

  it('xử lý sự kiện hold_expired: invalidate timeline và bookings', () => {
    renderHook(() => useOwnerRealtime({ venueId: 'v-1' }));
    const currentListener = mocks.getListener();

    act(() => {
      currentListener?.({
        type: 'hold_expired',
        payload: {
          bookingId: 'b-333-expired',
        },
      } as RealtimeEvent);
    });

    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'timeline'] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['owner', 'bookings'] });
  });

  it('không xử lý sự kiện khi enabled là false', () => {
    renderHook(() => useOwnerRealtime({ venueId: 'v-1', enabled: false }));
    const currentListener = mocks.getListener();

    act(() => {
      currentListener?.({
        type: 'booking_created',
        payload: {
          bookingId: 'b-999-booking-long-id',
          venueId: 'v-1',
          courtId: 'c-1',
        },
      });
    });

    expect(mocks.invalidateQueriesMock).not.toHaveBeenCalled();
    expect(mocks.toastMock.info).not.toHaveBeenCalled();
  });

  it('gọi callback onEvent tùy biến khi nhận được sự kiện', () => {
    const onEventSpy = vi.fn();
    renderHook(() => useOwnerRealtime({ venueId: 'v-1', onEvent: onEventSpy }));
    const currentListener = mocks.getListener();

    const event: RealtimeEvent = {
      type: 'slot_updated',
      payload: {
        venueId: 'v-1',
        courtId: 'c-1',
        date: '2026-11-02',
        slots: [
          {
            start: '2026-11-02T08:00:00+07:00',
            end: '2026-11-02T08:30:00+07:00',
            status: 'booked',
            price: 120000,
          },
        ],
      },
    };

    act(() => {
      currentListener?.(event);
    });

    expect(onEventSpy).toHaveBeenCalledWith(event);
  });
});
