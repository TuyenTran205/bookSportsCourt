/**
 * Hằng số thời gian cho phản hồi điều hướng — docs/specs/instant-navigation-loading-spec.md §3.2.
 *
 * Không tự ý đổi các giá trị này: chúng là hợp đồng với test ở §8.
 */
export const NAV_TIMING = {
  /** Không hiện thanh cho điều hướng tức thời (<120ms) — tránh nhấp nháy. */
  SHOW_DELAY_MS: 120,
  /** Nếu thanh đã hiện, giữ tối thiểu 300ms để không "chớp". */
  MIN_VISIBLE_MS: 300,
  /** Nhịp tăng tiến trình. */
  TRICKLE_INTERVAL_MS: 200,
  /** Chạy 90% → 100%. */
  COMPLETE_MS: 150,
  /** Mờ dần rồi unmount. */
  FADE_MS: 200,
  /** Chốt an toàn chống treo thanh khi middleware rewrite. */
  HARD_TIMEOUT_MS: 6000,
  /** Sau mốc này, live region đổi sang thông báo "kết nối chậm". */
  SLOW_HINT_MS: 800,
  /** Hover/focus đủ lâu mới prefetch (tránh quét chuột ngang sidebar). */
  PREFETCH_HOVER_MS: 80,
} as const;

/** Tiến trình tối đa khi còn pending — không bao giờ đầy khi chưa xong. */
export const MAX_PENDING_PROGRESS = 90;

/** Tiến trình khởi điểm khi thanh vừa mount. */
export const START_PROGRESS = 8;
