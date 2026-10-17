import { describe, expect, it } from 'vitest';
import {
  cancellationPolicySchema,
  ownerApplicationSchema,
  replyReviewSchema,
} from './schemas';

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

describe('replyReviewSchema', () => {
  it('trims the reply and rejects blank or oversized content', () => {
    expect(replyReviewSchema.parse({ ownerReply: '  Cảm ơn bạn!  ' }).ownerReply).toBe('Cảm ơn bạn!');
    expect(replyReviewSchema.safeParse({ ownerReply: '   ' }).success).toBe(false);
    expect(replyReviewSchema.safeParse({ ownerReply: 'a'.repeat(2001) }).success).toBe(false);
  });
});

describe('cancellationPolicySchema', () => {
  it('accepts supported values and rejects invalid ranges, fractions, and blank values', () => {
    expect(cancellationPolicySchema.safeParse({
      cancelBeforeHours: 24,
      refundPercent: 100,
      depositPercent: 30,
    }).success).toBe(true);
    expect(cancellationPolicySchema.parse({
      cancelBeforeHours: '24',
      refundPercent: '100',
      depositPercent: '30',
    }).depositPercent).toBe(30);
    expect(cancellationPolicySchema.safeParse({
      cancelBeforeHours: 721,
      refundPercent: 100,
      depositPercent: 30,
    }).success).toBe(false);
    expect(cancellationPolicySchema.safeParse({
      cancelBeforeHours: 24,
      refundPercent: 101,
      depositPercent: 30,
    }).success).toBe(false);
    expect(cancellationPolicySchema.safeParse({
      cancelBeforeHours: 24.5,
      refundPercent: 50,
      depositPercent: 30,
    }).success).toBe(false);
    expect(cancellationPolicySchema.safeParse({
      cancelBeforeHours: '',
      refundPercent: 50,
      depositPercent: 30,
    }).success).toBe(false);
    expect(cancellationPolicySchema.safeParse({
      cancelBeforeHours: null,
      refundPercent: 50,
      depositPercent: 30,
    }).success).toBe(false);
  });
});
