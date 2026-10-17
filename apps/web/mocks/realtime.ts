import type { SlotUpdatedPayload } from '@bsc/shared';
import type { NotificationType } from '@bsc/shared';

/**
 * Kênh realtime giả lập.
 *
 * Backend thật dùng Socket.IO (docs/05-booking-and-realtime.md). Khi chưa có
 * backend, ta mô phỏng cùng hành vi bằng `BroadcastChannel`:
 *
 * - Mọi thay đổi slot (giữ chỗ, duyệt, huỷ, hết hạn) đều phát một sự kiện
 *   `slot_updated` chỉ chứa **ô vừa đổi** — đúng như payload thật, không gửi
 *   cả lưới.
 * - `BroadcastChannel` không gửi cho chính tab đã phát, nên hàm `publish` phát
 *   thêm một sự kiện cục bộ để tab hiện tại cũng cập nhật.
 * - Nhờ vậy mở hai tab cạnh nhau sẽ thấy slot đổi màu tức thì ở cả hai.
 */

export type RealtimeEvent =
  | { type: 'slot_updated'; targetUserId?: string; payload: SlotUpdatedPayload }
  | {
      type: 'booking_created';
      targetUserId?: string;
      payload: { bookingId: string; venueId: string; courtId: string };
    }
  | {
      type: 'booking_confirmed';
      targetUserId?: string;
      payload: { bookingId: string };
    }
  | {
      type: 'hold_expired';
      targetUserId?: string;
      payload: { courtId: string; bookingId: string };
    }
  | {
      type: 'booking_cancelled';
      targetUserId?: string;
      payload: { bookingId: string; reason: string };
    }
  | {
      type: 'payment_submitted';
      targetUserId?: string;
      payload: { paymentId: string; bookingId: string; venueId: string };
    }
  | {
      type: 'payment_rejected';
      targetUserId?: string;
      payload: { bookingId: string; reason: string };
    }
  | {
      type: 'notification_created';
      /** Mock-only routing metadata; Socket.IO scopes this event by user room. */
      targetUserId?: string;
      payload: { id: string; type: NotificationType; title: string };
    };

const CHANNEL_NAME = 'bsc-realtime';
const LOCAL_EVENT = 'bsc-realtime-local';

type Listener = (event: RealtimeEvent) => void;

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/** Phát một sự kiện tới mọi tab (kể cả tab hiện tại). */
export function publish(event: RealtimeEvent): void {
  if (typeof window === 'undefined') return;
  getChannel()?.postMessage(event);
  // BroadcastChannel không phát cho chính tab gửi → phát cục bộ.
  window.dispatchEvent(new CustomEvent<RealtimeEvent>(LOCAL_EVENT, { detail: event }));
}

/** Lắng nghe sự kiện từ mọi tab. Trả về hàm huỷ đăng ký. */
export function subscribe(listener: Listener): () => void {
  if (typeof window === 'undefined') return () => {};

  const onMessage = (e: MessageEvent<RealtimeEvent>) => listener(e.data);
  const onLocal = (e: Event) => listener((e as CustomEvent<RealtimeEvent>).detail);

  const ch = getChannel();
  ch?.addEventListener('message', onMessage);
  window.addEventListener(LOCAL_EVENT, onLocal);

  return () => {
    ch?.removeEventListener('message', onMessage);
    window.removeEventListener(LOCAL_EVENT, onLocal);
  };
}

/** Tiện ích: phát thông báo slot đổi cho một sân trong một ngày. */
export function publishSlotUpdate(
  venueId: string,
  courtId: string,
  date: string,
  slots: SlotUpdatedPayload['slots'],
): void {
  publish({ type: 'slot_updated', payload: { venueId, courtId, date, slots } });
}
