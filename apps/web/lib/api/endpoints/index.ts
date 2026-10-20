/**
 * Tầng gọi API — một module cho mỗi nhóm endpoint trong
 * `docs/11-api-contract.md`.
 *
 * Quy ước:
 * - Mọi hàm trả `Promise` đã bóc lớp `{ data }`, hoặc ném `ApiError`.
 * - Không gọi `fetch` trực tiếp ở component; luôn đi qua đây để giữ một chỗ
 *   duy nhất xử lý base URL, header và lỗi.
 * - Hàm có phân trang trả `{ data, meta }` (hậu tố `...WithMeta` trong client).
 */

export * from './admin';
export * from './auth';
export * from './bookings';
export * from './notifications';
export * from './owner';
export * from './venues';
