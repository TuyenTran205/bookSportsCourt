'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { User, UserRole } from '@bsc/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/errors';
import { useSetUserRole } from '@/lib/hooks/useAdminUsers';

export interface UserRoleDialogProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

export function UserRoleDialog({ user, open, onClose }: UserRoleDialogProps) {
  const tCommon = useTranslations('common');
  const [selectedRole, setSelectedRole] = React.useState<UserRole>('customer');
  const roleMutation = useSetUserRole();

  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await roleMutation.mutateAsync({
        id: user.id,
        role: selectedRole,
      });
      toast.success(`Đã cập nhật vai trò cho người dùng ${user.fullName}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thay đổi vai trò người dùng</DialogTitle>
          <DialogDescription>
            Phân quyền hệ thống cho tài khoản <strong>{user.fullName}</strong> ({user.email}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Vai trò hệ thống</label>
            <Select
              value={selectedRole}
              onValueChange={(val) => setSelectedRole(val as UserRole)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-neutral-900">Khách hàng (Customer)</span>
                    <span className="text-xs text-neutral-500">Đặt sân, đánh giá, quản lý đơn cá nhân</span>
                  </div>
                </SelectItem>
                <SelectItem value="owner">
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-neutral-900">Chủ sân (Court Owner)</span>
                    <span className="text-xs text-neutral-500">Quản lý cơ sở, sân con, bảng giá, duyệt thanh toán</span>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-neutral-900">Quản trị viên (Admin)</span>
                    <span className="text-xs text-neutral-500">Toàn quyền kiểm soát và quản trị nền tảng</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={roleMutation.isPending || selectedRole === user.role}>
              {roleMutation.isPending ? tCommon('loading') : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
