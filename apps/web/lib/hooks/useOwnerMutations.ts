'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  approvePayment,
  createBlackout,
  createManualBooking,
  deleteBlackout,
  rejectPayment,
} from '@/lib/api/endpoints/owner';
import { ownerQueryKeys } from '@/lib/hooks/useOwnerTimeline';

/**
 * Đặt hộ khách tại quầy (OWN-07). Thành công thì làm mới mọi truy vấn của
 * chủ sân: lưới lịch cần hiện block mới, và số liệu tổng quan cũng đổi theo.
 */
export function useCreateManualBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createManualBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all }),
  });
}

/**
 * Tạo khoảng khoá sân bảo trì (Blackout - BSC-038).
 */
export function useCreateBlackout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      courtId,
      start,
      end,
      reason,
    }: {
      courtId: string;
      start: string;
      end: string;
      reason?: string;
    }) => createBlackout(courtId, { start, end, reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all }),
  });
}

/**
 * Mở khoá sân (xoá khoảng khoá bảo trì) (OWN-08).
 */
export function useDeleteBlackout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ courtId, blackoutId }: { courtId: string; blackoutId: string }) =>
      deleteBlackout(courtId, blackoutId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all }),
  });
}

/**
 * Duyệt thanh toán biên lai chuyển khoản (BSC-043).
 */
export function useApprovePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentId: string) => approvePayment(paymentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all }),
  });
}

/**
 * Từ chối thanh toán biên lai chuyển khoản (BSC-043).
 */
export function useRejectPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      rejectPayment(paymentId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all }),
  });
}

