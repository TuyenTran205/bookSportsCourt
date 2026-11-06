'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Lock,
  Search,
  Shield,
  ShieldAlert,
  Unlock,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type { User, UserRole, UserStatus } from '@bsc/shared';

import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { UserRoleDialog } from '@/components/features/admin/UserRoleDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/errors';
import { useAdminUsers, useSetUserStatus } from '@/lib/hooks/useAdminUsers';
import { formatDate } from '@/lib/utils/format';

export function AdminUsersScreen() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const [page, setPage] = React.useState(1);
  const [roleFilter, setRoleFilter] = React.useState<UserRole | undefined>(undefined);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [roleDialogOpen, setRoleDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const usersQuery = useAdminUsers({
    page,
    limit: 10,
    role: roleFilter,
    q: debouncedSearch.trim() || undefined,
  });

  const statusMutation = useSetUserStatus();

  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;

  const handleToggleStatus = async (user: User) => {
    const isLocking = user.status === 'active';
    const actionLabel = isLocking ? 'khoá' : 'mở khoá';

    if (user.role === 'admin' && isLocking) {
      toast.error('Không thể khoá tài khoản Quản trị viên');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn ${actionLabel} tài khoản "${user.fullName}"?`)) {
      return;
    }

    try {
      await statusMutation.mutateAsync({
        id: user.id,
        status: isLocking ? 'suspended' : 'active',
      });
      toast.success(`Đã ${actionLabel} tài khoản thành công`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
            <ShieldAlert className="size-3 text-purple-600" />
            Quản trị viên
          </span>
        );
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            <Shield className="size-3 text-blue-600" />
            Chủ sân
          </span>
        );
      case 'customer':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
            <UserIcon className="size-3 text-neutral-500" />
            Khách hàng
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('users')}
        description="Quản lý danh sách tài khoản toàn hệ thống, phân quyền và quản lý trạng thái hoạt động."
      />

      {/* Thanh tìm kiếm & bộ lọc */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo họ tên hoặc email..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={roleFilter === undefined ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setRoleFilter(undefined);
              setPage(1);
            }}
          >
            Tất cả vai trò
          </Button>
          <Button
            variant={roleFilter === 'customer' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setRoleFilter('customer');
              setPage(1);
            }}
          >
            Khách hàng
          </Button>
          <Button
            variant={roleFilter === 'owner' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setRoleFilter('owner');
              setPage(1);
            }}
          >
            Chủ sân
          </Button>
          <Button
            variant={roleFilter === 'admin' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setRoleFilter('admin');
              setPage(1);
            }}
          >
            Quản trị viên
          </Button>
        </div>
      </div>

      {usersQuery.isPending ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : usersQuery.isError ? (
        <ErrorState
          error={usersQuery.error}
          onRetry={() => void usersQuery.refetch()}
        />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Không tìm thấy người dùng"
          description="Không có tài khoản nào khớp với từ khoá hoặc vai trò bạn đang tìm."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
                    <th className="py-3 px-4">Người dùng</th>
                    <th className="py-3 px-4">Số điện thoại</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Ngày tham gia</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                            {user.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900">{user.fullName}</p>
                            <p className="text-xs text-neutral-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-neutral-600">
                        {user.phone ?? '—'}
                      </td>
                      <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                      <td className="py-3 px-4 text-xs text-neutral-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge kind="user" status={user.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setRoleDialogOpen(true);
                            }}
                            title="Thay đổi vai trò người dùng"
                          >
                            <Shield className="mr-1 size-3.5" />
                            Phân quyền
                          </Button>

                          {user.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={statusMutation.isPending || user.role === 'admin'}
                              onClick={() => handleToggleStatus(user)}
                              className="text-danger hover:bg-danger/10 hover:text-danger"
                              title={user.role === 'admin' ? 'Không thể khoá Admin' : 'Khoá tài khoản'}
                            >
                              <Lock className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={statusMutation.isPending}
                              onClick={() => handleToggleStatus(user)}
                              className="text-primary-700 hover:bg-primary-50"
                              title="Mở khoá tài khoản"
                            >
                              <Unlock className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {meta && (
            <Pagination
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      <UserRoleDialog
        user={selectedUser}
        open={roleDialogOpen}
        onClose={() => {
          setRoleDialogOpen(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
