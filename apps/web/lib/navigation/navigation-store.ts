/**
 * Store điều hướng ngoài React — nguồn sự thật duy nhất cho phản hồi chuyển trang.
 * Đặc tả: docs/specs/instant-navigation-loading-spec.md §3, §6.4.
 *
 * Vì sao không dùng Context: store phải đọc được từ event listener toàn cục
 * (`document` click) và từ `useAppRouter`, tức là ngoài cây React. Một module
 * singleton + `useSyncExternalStore` cho phép cả hai mà không cần provider.
 *
 * Mọi truy cập `window` đều nằm trong timer/handler, không chạy lúc render server.
 */
import {
  MAX_PENDING_PROGRESS,
  NAV_TIMING,
  START_PROGRESS,
} from './constants';

export type NavigationPhase = 'idle' | 'pending' | 'completing';

export interface NavigationSnapshot {
  phase: NavigationPhase;
  /** pathname + search của đích; null khi idle */
  target: string | null;
  /** 0–100, chỉ dùng để vẽ thanh */
  progress: number;
  /** thời điểm bắt đầu, ms epoch; null khi idle */
  startedAt: number | null;
  /** Thanh đã qua SHOW_DELAY_MS và được phép mount */
  visible: boolean;
  /** Đang mờ dần trước khi unmount */
  fading: boolean;
}

export const INITIAL_SNAPSHOT: NavigationSnapshot = {
  phase: 'idle',
  target: null,
  progress: 0,
  startedAt: null,
  visible: false,
  fading: false,
};

let snapshot: NavigationSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

/** Thời điểm thanh thực sự hiện — dùng cho MIN_VISIBLE_MS. */
let visibleAt = 0;

let showTimer: ReturnType<typeof setTimeout> | null = null;
let trickleTimer: ReturnType<typeof setInterval> | null = null;
let hardTimer: ReturnType<typeof setTimeout> | null = null;
let finishTimer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: NavigationSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function clearTimers() {
  if (showTimer !== null) clearTimeout(showTimer);
  if (trickleTimer !== null) clearInterval(trickleTimer);
  if (hardTimer !== null) clearTimeout(hardTimer);
  if (finishTimer !== null) clearTimeout(finishTimer);
  if (fadeTimer !== null) clearTimeout(fadeTimer);
  showTimer = null;
  trickleTimer = null;
  hardTimer = null;
  finishTimer = null;
  fadeTimer = null;
}

function startTrickle() {
  if (trickleTimer !== null) return;
  trickleTimer = setInterval(() => {
    if (snapshot.phase !== 'pending') return;
    const next =
      snapshot.progress + (MAX_PENDING_PROGRESS - snapshot.progress) * 0.12;
    emit({
      ...snapshot,
      progress: Math.min(MAX_PENDING_PROGRESS, next),
    });
  }, NAV_TIMING.TRICKLE_INTERVAL_MS);
}

function scheduleShow() {
  showTimer = setTimeout(() => {
    showTimer = null;
    if (snapshot.phase !== 'pending') return;
    visibleAt = Date.now();
    emit({ ...snapshot, visible: true });
    startTrickle();
  }, NAV_TIMING.SHOW_DELAY_MS);
}

function scheduleHardTimeout() {
  hardTimer = setTimeout(() => {
    hardTimer = null;
    // Middleware rewrite làm pathname không đổi → đây là chốt an toàn duy nhất.
    cancelNavigation();
  }, NAV_TIMING.HARD_TIMEOUT_MS);
}

/**
 * Bắt đầu (hoặc chuyển hướng) một lần điều hướng.
 * Idempotent theo `target`; đổi target giữa chừng không reset thanh (E2, UT-NAV-03).
 */
export function startNavigation(href: string): void {
  if (href.length === 0) return;

  if (snapshot.phase === 'pending') {
    if (snapshot.target === href) return;
    // Thanh đã chạy: chỉ đổi đích, giữ nguyên % để không nhấp nháy.
    emit({ ...snapshot, target: href });
    return;
  }

  // Từ idle hoặc completing: dựng lại từ đầu, dọn timer của lần trước.
  clearTimers();
  visibleAt = 0;
  emit({
    phase: 'pending',
    target: href,
    progress: START_PROGRESS,
    startedAt: Date.now(),
    visible: false,
    fading: false,
  });
  scheduleShow();
  scheduleHardTimeout();
}

/** Route đã commit — chạy 100%, giữ tối thiểu MIN_VISIBLE_MS, rồi mờ dần. */
export function completeNavigation(): void {
  if (snapshot.phase === 'idle') return;

  const wasVisible = snapshot.visible;

  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (trickleTimer !== null) {
    clearInterval(trickleTimer);
    trickleTimer = null;
  }
  if (hardTimer !== null) {
    clearTimeout(hardTimer);
    hardTimer = null;
  }

  // Điều hướng xong trước khi thanh kịp hiện → không nháy gì cả.
  if (!wasVisible) {
    clearTimers();
    emit(INITIAL_SNAPSHOT);
    return;
  }

  emit({ ...snapshot, phase: 'completing', progress: 100 });

  const elapsed = Date.now() - visibleAt;
  const hold = Math.max(
    NAV_TIMING.COMPLETE_MS,
    NAV_TIMING.MIN_VISIBLE_MS - elapsed,
  );

  finishTimer = setTimeout(() => {
    finishTimer = null;
    emit({ ...snapshot, fading: true });
    fadeTimer = setTimeout(() => {
      fadeTimer = null;
      emit(INITIAL_SNAPSHOT);
    }, NAV_TIMING.FADE_MS);
  }, hold);
}

/** Huỷ ngay, không animate — dùng khi điều hướng ném lỗi hoặc timeout cứng. */
export function cancelNavigation(): void {
  clearTimers();
  visibleAt = 0;
  if (snapshot.phase === 'idle' && !snapshot.visible) return;
  emit(INITIAL_SNAPSHOT);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): NavigationSnapshot {
  return snapshot;
}

export function getServerSnapshot(): NavigationSnapshot {
  return INITIAL_SNAPSHOT;
}
