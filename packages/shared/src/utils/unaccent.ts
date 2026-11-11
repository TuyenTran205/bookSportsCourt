/**
 * Tiện ích chuẩn hoá tiếng Việt không dấu dùng cho tìm kiếm và autocomplete.
 *
 * Loại bỏ dấu thanh, chuyển đ/Đ thành d/D, chuẩn hoá khoảng trắng và chữ thường.
 */

export function toUnaccent(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Bí danh cho toUnaccent để dễ gợi nhớ khi xử lý text */
export const normalizeText = toUnaccent;

/**
 * Tạo URL slug chuẩn từ chuỗi tiếng Việt (chữ thường, không dấu, ngăn cách bằng dấu gạch ngang).
 * Ví dụ: "Bóng đá mini" -> "bong-da-mini", "Trạm sạc xe điện EV" -> "tram-sac-xe-dien-ev"
 */
export function slugify(str: string | null | undefined): string {
  if (!str) return 'item';
  return toUnaccent(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

/**
 * Kiểm tra xem `target` có chứa chuỗi `query` hay không (không phân biệt dấu và hoa thường).
 */
export function matchUnaccent(query: string, target: string): boolean {
  const normQuery = toUnaccent(query);
  if (!normQuery) return true;
  const normTarget = toUnaccent(target);
  return normTarget.includes(normQuery);
}
