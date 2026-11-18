'use client';

import { useEffect } from 'react';

import { useSocket } from '@/components/common/SocketProvider';

/**
 * Vào room `venue:{venueId}:date:{date}` khi xem lưới slot của một sân trong ngày,
 * để nhận `slot_updated` realtime khi có người giữ/đặt/huỷ. Rời room khi đổi ngày
 * hoặc unmount. Ở mock mode đây là no-op (BroadcastChannel không cần room).
 */
export function useVenueRoom(venueId: string | undefined, date: string): void {
  const { joinVenue, leaveVenue } = useSocket();

  useEffect(() => {
    if (!venueId) return;
    joinVenue(venueId, date);
    return () => leaveVenue(venueId, date);
  }, [venueId, date, joinVenue, leaveVenue]);
}
