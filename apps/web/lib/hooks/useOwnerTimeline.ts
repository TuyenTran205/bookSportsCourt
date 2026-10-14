'use client';

import { useQuery } from '@tanstack/react-query';

import { getOwnerTimeline, listOwnerVenues } from '@/lib/api/endpoints/owner';

/**
 * Truy vấn cho `OwnerTimeline` (OWN-06).
 *
 * Hai lượt gọi tách rời có chủ đích: danh sách cơ sở đổi rất chậm (gần như cố
 * định trong một phiên), còn lưới theo ngày thì đổi mỗi lần chuyển ngày. Gộp
 * lại sẽ khiến mỗi lần bấm "ngày mai" phải tải lại cả danh sách cơ sở.
 */

/** Khoá cache — gom một chỗ để `invalidateQueries` không gõ sai chuỗi. */
export const ownerQueryKeys = {
  all: ['owner'] as const,
  venues: () => [...ownerQueryKeys.all, 'venues'] as const,
  timeline: (venueId: string, date: string) =>
    [...ownerQueryKeys.all, 'timeline', venueId, date] as const,
};

/** Cơ sở của chủ sân đang đăng nhập — dùng cho bộ chọn cơ sở. */
export function useOwnerVenues() {
  return useQuery({
    queryKey: ownerQueryKeys.venues(),
    queryFn: listOwnerVenues,
    // Danh sách cơ sở ít đổi; giữ lâu để chuyển qua lại không nhấp nháy.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Một ngày của một cơ sở.
 *
 * `venueId` là bắt buộc trên thực tế: lưới vẽ giờ mở cửa theo cơ sở, nên chỉ
 * gọi khi đã chọn được cơ sở. Truyền `null` (chưa chọn xong) thì hook nằm im
 * thay vì bắn một request chắc chắn lỗi.
 */
export function useOwnerTimeline(venueId: string | null, date: string) {
  return useQuery({
    queryKey: ownerQueryKeys.timeline(venueId ?? '', date),
    queryFn: () => getOwnerTimeline(venueId as string, date),
    enabled: venueId !== null,
    // Lưới là dữ liệu sống: có người đặt sân trong lúc chủ sân đang xem.
    staleTime: 30 * 1000,
  });
}
