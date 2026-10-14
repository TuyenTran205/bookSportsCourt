import { describe, expect, it } from 'vitest';
import { ownerApplicationSchema } from './schemas';

const validApplication = {
  businessName: 'Sân thể thao Phú Nhuận',
  phone: '0901234567',
  address: '12 Nguyễn Văn Trỗi, Phú Nhuận, TP. Hồ Chí Minh',
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: '0123456789',
  accountName: 'NGUYEN VAN A',
};

describe('ownerApplicationSchema', () => {
  it('accepts the complete application and optional CCCD number', () => {
    const result = ownerApplicationSchema.safeParse({
      ...validApplication,
      taxCode: '012345678901',
      idCardUrl: 'https://example.com/owner-document.jpg',
    });

    expect(result.success).toBe(true);
  });

  it('allows omitted optional fields', () => {
    const result = ownerApplicationSchema.safeParse(validApplication);

    expect(result.success).toBe(true);
  });

  it('rejects malformed phone numbers and bank account numbers', () => {
    const result = ownerApplicationSchema.safeParse({
      ...validApplication,
      phone: '1234',
      accountNo: '1234abc',
    });

    expect(result.success).toBe(false);
  });
});
