// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { DataTable, type Column } from './data-table';

afterEach(cleanup);

interface Item {
  id: string;
  name: string;
  count: number;
}

const columns: Column<Item>[] = [
  { key: 'name', header: 'Tên', cell: (row) => row.name },
  { key: 'count', header: 'Số lượng', cell: (row) => row.count, align: 'right' },
];

const mockRows: Item[] = [
  { id: '1', name: 'Sân số 1', count: 10 },
  { id: '2', name: 'Sân số 2', count: 20 },
];

describe('WT-NAV-13: DataTable - isFetching behavior', () => {
  it('khi isFetching=true, table có aria-busy="true", class opacity-60, và vẫn giữ nguyên các dòng cũ', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={mockRows}
        getRowId={(r) => r.id}
        isFetching={true}
      />,
    );

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.getAttribute('aria-busy')).toBe('true');
    expect(table?.classList.contains('opacity-60')).toBe(true);

    // Vẫn hiển thị đầy đủ các dòng cũ
    expect(screen.getByText('Sân số 1')).toBeDefined();
    expect(screen.getByText('Sân số 2')).toBeDefined();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('khi isFetching=false và loading=false, table không có aria-busy và không có class opacity-60', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={mockRows}
        getRowId={(r) => r.id}
        isFetching={false}
        loading={false}
      />,
    );

    const table = container.querySelector('table');
    expect(table?.getAttribute('aria-busy')).toBeNull();
    expect(table?.classList.contains('opacity-60')).toBe(false);
  });

  it('khi isFetching=true kèm pagination, hiển thị spinner trạng thái đang tải', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={mockRows}
        getRowId={(r) => r.id}
        isFetching={true}
        pagination={<div data-testid="pagination">Trang 1</div>}
      />,
    );

    const spinner = container.querySelector('.bsc-spinner');
    expect(spinner).not.toBeNull();
    expect(screen.getByTestId('pagination')).toBeDefined();
  });
});
