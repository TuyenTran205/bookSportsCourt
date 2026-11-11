import { describe, expect, it } from 'vitest';
import { extractAddressAndNote } from './geocoding';

describe('geocoding utils', () => {
  it('tách đúng địa chỉ và phần ghi chú mở ngoặc (*)', () => {
    const raw = '35 Dịch Vọng Hậu, Cầu Giấy, Hà Nội (* Cổng phụ cạnh tòa FPT)';
    const result = extractAddressAndNote(raw);
    expect(result.address).toBe('35 Dịch Vọng Hậu, Cầu Giấy, Hà Nội');
    expect(result.note).toBe('Cổng phụ cạnh tòa FPT');
  });

  it('xử lý địa chỉ không có ghi chú', () => {
    const raw = '12 Đường Như Nguyệt, Hải Châu, Đà Nẵng';
    const result = extractAddressAndNote(raw);
    expect(result.address).toBe('12 Đường Như Nguyệt, Hải Châu, Đà Nẵng');
    expect(result.note).toBeNull();
  });
});
