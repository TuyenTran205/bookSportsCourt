// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { AdminAuditLogsScreen } from './AdminAuditLogsScreen';
import * as useAdminAuditLogsModule from '@/lib/hooks/useAdminAuditLogs';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      auditLogs: 'Nhật ký kiểm toán',
    };
    return translations[key] ?? key;
  },
}));

describe('AdminAuditLogsScreen Component (TC-DM-07: Dark Mode Styling)', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('render bảng Audit Logs với semantic tokens bg-bg-subtle, text-text-secondary và dark action badges', () => {
    vi.spyOn(useAdminAuditLogsModule, 'useAdminAuditLogs').mockReturnValue({
      data: {
        data: [
          {
            id: 'audit-1',
            actorId: 'admin-1',
            actorName: 'Admin Tuyen',
            action: 'venue.approve',
            entityType: 'venue',
            entityId: 'venue-101',
            metadata: { venueName: 'Sân bóng Thăng Long' },
            createdAt: '2026-03-30T10:00:00.000Z',
          },
          {
            id: 'audit-2',
            actorId: 'admin-1',
            actorName: 'Admin Tuyen',
            action: 'owner_application.reject',
            entityType: 'owner_application',
            entityId: 'app-202',
            metadata: { reviewNote: 'Thiếu giấy phép kinh doanh' },
            createdAt: '2026-03-30T11:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAdminAuditLogsModule.useAdminAuditLogs>);

    const { container } = render(<AdminAuditLogsScreen />);

    // Kiểm tra header thead
    const theadRow = container.querySelector('thead tr');
    expect(theadRow).not.toBeNull();
    expect(theadRow?.className).toContain('border-border');
    expect(theadRow?.className).toContain('bg-bg-subtle');
    expect(theadRow?.className).toContain('text-text-secondary');

    // Kiểm tra chip hành động 'Phê duyệt' có biến thể dark
    const approveBadge = screen.getByText('Phê duyệt');
    expect(approveBadge.className).toContain('dark:bg-primary-950');
    expect(approveBadge.className).toContain('dark:text-primary-300');

    // Kiểm tra chip hành động 'Từ chối' có biến thể dark
    const rejectBadge = screen.getByText('Từ chối');
    expect(rejectBadge.className).toContain('dark:bg-red-950');
    expect(rejectBadge.className).toContain('dark:text-red-300');

    // Kiểm tra hàng tbody có hover:bg-bg-subtle/50
    const tbodyRow = container.querySelector('tbody tr');
    expect(tbodyRow).not.toBeNull();
    expect(tbodyRow?.className).toContain('hover:bg-bg-subtle/50');
  });
});
