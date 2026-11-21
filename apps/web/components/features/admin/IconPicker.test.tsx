/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { IconPicker } from './IconPicker';
import { SPORT_ICON_OPTIONS } from './catalog-icons';

describe('IconPicker Component', () => {
  it('hiển thị đầy đủ các icon thể thao và làm mờ các icon đã cấu hình (disabledIds)', () => {
    const handleChange = vi.fn();
    const disabledIds = ['badminton', 'soccer', 'tennis'];
    const disabledReasonMap = {
      badminton: 'Cầu lông',
      soccer: 'Bóng đá',
      tennis: 'Tennis',
    };

    render(
      <IconPicker
        options={SPORT_ICON_OPTIONS}
        value="table-tennis"
        onChange={handleChange}
        disabledIds={disabledIds}
        disabledReasonMap={disabledReasonMap}
      />,
    );

    // Kiểm tra icon Cầu lông (đã cấu hình) bị disabled
    const badmintonBtn = screen.getByRole('button', { name: /Cầu lông/i });
    expect(badmintonBtn).toBeDisabled();
    expect(badmintonBtn).toHaveAttribute('aria-disabled', 'true');
    expect(badmintonBtn.className).toContain('opacity-45');
    expect(badmintonBtn.className).toContain('cursor-not-allowed');

    // Thử click vào icon đã bị disabled -> không gọi onChange
    fireEvent.click(badmintonBtn);
    expect(handleChange).not.toHaveBeenCalled();

    // Kiểm tra icon Bóng bàn (chưa cấu hình) vẫn clickable bình thường
    const tableTennisBtn = screen.getByRole('button', { name: /Bóng bàn/i });
    expect(tableTennisBtn).not.toBeDisabled();
    fireEvent.click(tableTennisBtn);
    expect(handleChange).toHaveBeenCalledWith('table-tennis');
  });
});
