'use client';

import * as React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminVenueRow } from '@/lib/api/endpoints/admin';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/errors';
import { useDeleteVenue } from '@/lib/hooks/useAdminVenues';

export interface DeleteVenueDialogProps {
  venue: AdminVenueRow | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteVenueDialog({
  venue,
  open,
  onClose,
  onSuccess,
}: DeleteVenueDialogProps) {
  const deleteMutation = useDeleteVenue();

  if (!venue) return null;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(venue.id);
      toast.success(`Đã xóa cơ sở "${venue.name}" thành công`);
      onClose();
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESOURCE_IN_USE') {
        toast.error('Địa điểm còn lịch đặt sân đang hoạt động, không thể xóa.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Không thể xóa cơ sở');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base text-neutral-900">
                Xác nhận xóa mềm cơ sở
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                Hành động này sẽ ẩn cơ sở khỏi hệ thống
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm text-neutral-600">
          <p>
            Bạn có chắc chắn muốn xóa cơ sở{' '}
            <span className="font-semibold text-neutral-900">{venue.name}</span>{' '}
            thuộc chủ sân{' '}
            <span className="font-medium text-neutral-800">{venue.ownerName}</span>?
          </p>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium">Lưu ý quan trọng:</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Cơ sở chỉ có thể xóa khi không còn booking nào đang chờ duyệt hoặc đã xác nhận. Dữ liệu lịch sử giao dịch vẫn được lưu trữ.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={deleteMutation.isPending}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
            className="bg-danger text-white hover:bg-danger/90"
          >
            {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
