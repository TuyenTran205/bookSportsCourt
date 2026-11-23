import { setupWorker } from 'msw/browser';
import { db, saveCurrentUserId, subscribeToStorage } from './db';
import { clearSession, setSession } from './handlers/auth';
import { handlers } from './handlers';

/**
 * MSW cho trình duyệt.
 *
 * `onUnhandledRequest: 'bypass'` để request không có handler (asset, ảnh, HMR)
 * đi thẳng ra ngoài thay vì bị cảnh báo — nếu để mặc định, console đầy cảnh báo
 * và che mất lỗi thật.
 */
export const worker = setupWorker(...handlers);

/**
 * Cache chính promise khởi động chứ không chỉ một cờ boolean. React StrictMode (dev)
 * chạy effect hai lần: nếu lần hai chỉ thấy cờ `started` rồi trả về ngay thì
 * `MockProvider` tưởng worker đã sẵn sàng và render app sớm, các request đầu
 * (vd. `/users/me`) đi ra ngoài trước khi service worker kịp chặn → 404.
 */
let starting: Promise<unknown> | null = null;

export async function startMocking(): Promise<void> {
  if (!starting) {
    // Đồng bộ state khi tab khác thao tác (điều kiện để demo Kịch bản B).
    subscribeToStorage();

    // Đồng bộ session cookie và db.currentUserId:
    // Nếu trình duyệt / Playwright test đã có sẵn cookie bsc_session thì ưu tiên giữ nguyên phiên đó;
    // ngược lại mới dùng db.currentUserId hoặc xoá phiên đối với khách vãng lai (guest).
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)bsc_session=([^;]+)/);
      if (match && match[1] && match[1] !== 'guest') {
        const existingId = decodeURIComponent(match[1]);
        db.currentUserId = existingId;
        saveCurrentUserId(existingId);
        setSession(existingId);
      } else if (match && match[1] === 'guest') {
        db.currentUserId = null;
        saveCurrentUserId(null);
        clearSession();
      } else if (db.currentUserId) {
        setSession(db.currentUserId);
      } else {
        clearSession();
      }
    }

    starting = worker.start({
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: { url: '/mockServiceWorker.js' },
    });

    // Khi người dùng quay lại tab sau khi để trang idle (trình duyệt có thể đã tạm dừng SW),
    // gửi keepalive để đánh thức và duy trì active client ID trong service worker.
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const pingWorker = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage('KEEPALIVE_REQUEST');
        }
      };
      window.addEventListener('focus', pingWorker);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') pingWorker();
      });
    }
  }
  await starting;
}
