import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Ward } from "../../../../../packages/shared/src/types.js";

/**
 * Nạp danh mục 3.321 phường/xã/đặc khu từ `packages/shared/src/data/wards.json`.
 *
 * Theo `docs/18-decision-log.md`, file JSON ~320KB này **chỉ** được dùng ở BE /
 * seed / MSW server-side – tuyệt đối không bundle vào client. Vì vậy BE đọc
 * bằng `fs` (không `import` JSON) để không kéo dữ liệu vào bundle FE.
 *
 * Đọc một lần rồi cache trong tiến trình vì danh mục là dữ liệu tĩnh.
 */
const wardsFilePath = fileURLToPath(
  new URL(
    "../../../../../packages/shared/src/data/wards.json",
    import.meta.url,
  ),
);

let cache: Ward[] | null = null;

export function loadWards(): Ward[] {
  if (cache === null) {
    cache = JSON.parse(readFileSync(wardsFilePath, "utf8")) as Ward[];
  }
  return cache;
}