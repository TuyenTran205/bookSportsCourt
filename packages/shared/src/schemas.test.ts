import { describe, expect, it } from 'vitest';
import {
  areaSchema,
  cancellationPolicySchema,
  createVenueSchema,
  ownerApplicationSchema,
  provinceCodeSchema,
  replyReviewSchema,
  venueSearchSchema,
  wardCodeSchema,
} from './schemas';
import { matchUnaccent, toUnaccent } from './utils/unaccent';
import { PROVINCES } from './data/provinces';
import rawWards from './data/wards.json';

const validApplication = {
  businessName: 'Sân thể thao Phú Nhuận',
  phone: '0901234567',
  address: '12 Nguyễn Văn Trỗi, Phú Nhuận, TP. Hồ Chí Minh',
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: '0123456789',
  accountName: 'NGUYEN VAN A',
};

describe('provinceCodeSchema & wardCodeSchema (TC-LOC-08)', () => {
  it('accepts 2-digit province codes with leading zero and rejects invalid codes', () => {
    expect(provinceCodeSchema.safeParse('01').success).toBe(true);
    expect(provinceCodeSchema.safeParse('79').success).toBe(true);
    expect(provinceCodeSchema.safeParse('1').success).toBe(false);
    expect(provinceCodeSchema.safeParse('001').success).toBe(false);
    expect(provinceCodeSchema.safeParse('AB').success).toBe(false);
  });

  it('accepts 5-digit ward codes with leading zero and rejects invalid codes', () => {
    expect(wardCodeSchema.safeParse('00001').success).toBe(true);
    expect(wardCodeSchema.safeParse('26734').success).toBe(true);
    expect(wardCodeSchema.safeParse('1').success).toBe(false);
    expect(wardCodeSchema.safeParse('0001').success).toBe(false);
    expect(wardCodeSchema.safeParse('000001').success).toBe(false);
  });
});

describe('areaSchema', () => {
  it('allows province without parentId', () => {
    expect(
      areaSchema.safeParse({
        name: 'Hà Nội',
        slug: 'ha-noi',
        type: 'province',
      }).success,
    ).toBe(true);
  });

  it('requires parentId for ward and district', () => {
    expect(
      areaSchema.safeParse({
        name: 'Phường Phúc Xá',
        slug: 'phuc-xa',
        type: 'ward',
      }).success,
    ).toBe(false);

    expect(
      areaSchema.safeParse({
        name: 'Phường Phúc Xá',
        slug: 'phuc-xa',
        type: 'ward',
        parentId: '019273c5-7f00-7000-0000-000000000001',
      }).success,
    ).toBe(true);
  });
});

describe('unaccent utilities (TC-LOC-04)', () => {
  it('normalizes Vietnamese accents and handles search matches', () => {
    expect(toUnaccent('Thành phố Hà Nội')).toBe('thanh pho ha noi');
    expect(toUnaccent('Đà Nẵng')).toBe('da nang');
    expect(toUnaccent('Phường Bến Nghé')).toBe('phuong ben nghe');

    expect(matchUnaccent('ha noi', 'Thành phố Hà Nội')).toBe(true);
    expect(matchUnaccent('ben nghe', 'Phường Bến Nghé')).toBe(true);
    expect(matchUnaccent('hai chau', 'Phường Hải Châu I')).toBe(true);
    expect(matchUnaccent('sai gon', 'Thành phố Hà Nội')).toBe(false);
  });
});

describe('PROVINCES dataset (TC-LOC-01)', () => {
  it('contains exactly 34 provinces including 6 municipalities', () => {
    expect(PROVINCES).toHaveLength(34);
    const municipalities = PROVINCES.filter((p) => p.isMunicipality);
    expect(municipalities).toHaveLength(6);
    const codes = municipalities.map((m) => m.code);
    expect(codes).toContain('01'); // Ha Noi
    expect(codes).toContain('79'); // TP HCM
    expect(codes).toContain('48'); // Da Nang
    expect(codes).toContain('31'); // Hai Phong
    expect(codes).toContain('46'); // Hue
    expect(codes).toContain('92'); // Can Tho
  });
});

describe('WARDS dataset (TC-LOC-02)', () => {
  it('contains exactly 3321 administrative units with valid types and province codes', () => {
    expect(rawWards).toHaveLength(3321);

    const validProvinceCodes = new Set(PROVINCES.map((p) => p.code));
    const wardTypes = new Set(rawWards.map((w) => w.type));

    // Phải gồm cả Xã (commune), Phường (ward), Đặc khu (special_zone)
    expect(wardTypes.has('ward')).toBe(true);
    expect(wardTypes.has('commune')).toBe(true);
    expect(wardTypes.has('special_zone')).toBe(true);

    // Mọi đơn vị đều phải có provinceCode thuộc 34 tỉnh và mã 5 chữ số
    for (const ward of rawWards) {
      expect(validProvinceCodes.has(ward.provinceCode)).toBe(true);
      expect(ward.code).toMatch(/^\d{5}$/);
      expect(ward.name.length).toBeGreaterThan(0);
      expect(ward.slug.length).toBeGreaterThan(0);
    }
  });
});

describe('createVenueSchema & venueSearchSchema (TC-LOC-07 & TC-LOC-08)', () => {
  const validVenuePayload = {
    name: 'Sân Cầu Lông Ba Đình',
    address: '123 Hoàng Hoa Thám',
    provinceId: '019273c5-7f00-7000-0000-000000000001',
    provinceCode: '01',
    wardId: '019273c5-7f00-7000-0001-000000000001',
    wardCode: '00001',
    lat: 21.0378,
    lng: 105.8234,
    amenityIds: [],
  };

  it('accepts venue with valid provinceId and wardId', () => {
    const parsed = createVenueSchema.safeParse(validVenuePayload);
    expect(parsed.success).toBe(true);
  });

  it('rejects venue when neither wardId nor districtId is provided', () => {
    const invalid = { ...validVenuePayload };
    delete (invalid as Record<string, unknown>).wardId;
    delete (invalid as Record<string, unknown>).wardCode;

    const parsed = createVenueSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('Vui lòng chọn xã/phường');
    }
  });

  it('supports venueSearchSchema with provinceId, wardId, provinceCode and wardCode', () => {
    const query = {
      provinceId: '019273c5-7f00-7000-0000-000000000001',
      provinceCode: '01',
      wardId: '019273c5-7f00-7000-0001-000000000001',
      wardCode: '00001',
      page: '1',
      limit: '20',
    };
    const parsed = venueSearchSchema.safeParse(query);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.limit).toBe(20);
      expect(parsed.data.provinceCode).toBe('01');
      expect(parsed.data.wardCode).toBe('00001');
    }
  });
});

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
