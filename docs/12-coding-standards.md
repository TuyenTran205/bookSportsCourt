# 12 – Tiêu chuẩn code

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30

## TypeScript Strict

Tất cả apps và packages dùng TypeScript strict mode:
```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**CẤM:**
```typescript
// ❌ SAI
const data: any = response;
// @ts-ignore
const x = y.z;
function foo(a: any) {}

// ✅ ĐÚNG
const data: VenueResponse = response;
const x = y?.z ?? defaultValue;
function foo(a: CreateVenueDto) {}
```

## ESLint + Prettier

Cấu hình tại gốc monorepo. Chạy: `pnpm lint` và `pnpm format`.

**Rules quan trọng:**
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-non-null-assertion`: warn
- `no-console`: warn (dùng logger)
- `import/order`: error (thứ tự import)

## Quy tắc import

```typescript
// Thứ tự import (tự động sort bởi ESLint plugin):
// 1. Node.js built-ins
// 2. External packages
// 3. packages/shared
// 4. Internal (relative)

import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { BookingStatus } from '@bsc/shared/constants';

import { BookingsRepository } from './bookings.repository';
```

## Conventional Commits

Format: `<type>(<scope>): <mô tả ngắn> #<issue>`

| Type | Dùng khi |
|------|---------|
| `feat` | Tính năng mới |
| `fix` | Sửa lỗi |
| `docs` | Cập nhật tài liệu |
| `chore` | Cấu hình, deps |
| `refactor` | Refactor, không thay đổi hành vi |
| `test` | Thêm/sửa test |
| `ci` | CI/CD |

**Ví dụ:**
```
feat(booking): implement hold creation with EXCLUDE constraint #42
fix(auth): refresh token rotation not revoking old token #38
docs(schema): add bookings table ERD description #15
test(booking): add concurrent hold race condition test #42
```

## Definition of Done (DoD)

Một issue được coi là hoàn thành khi:
- [ ] Code đã được review và approve bởi ít nhất 1 thành viên khác
- [ ] CI pass (lint, typecheck, test, build)
- [ ] Unit test đã được viết (bắt buộc với booking/giá/phân quyền)
- [ ] OpenAPI đã được cập nhật nếu thay đổi API
- [ ] Migration đã được tạo nếu thay đổi DB
- [ ] Tài liệu liên quan đã được cập nhật trong cùng PR
- [ ] PR UI có ảnh chụp 375px và 1440px
- [ ] Không có `any`, `@ts-ignore` không lý do
- [ ] Không có `console.log` chưa xoá

## Chiến lược Test

### Unit Test (Vitest cho FE, Jest cho BE)
```typescript
// Bắt buộc test cho: BookingService, PricingService, AuthGuard
describe('BookingService.createHold', () => {
  it('should throw 409 when slot is already held', async () => {
    // ...
  });
});
```

### API Test (Supertest)
```typescript
// Test integration endpoints quan trọng
it('POST /api/v1/bookings/hold - concurrent requests', async () => {
  const requests = Array(5).fill(null).map(() =>
    request(app).post('/api/v1/bookings/hold').send(sameSlotDto)
  );
  const results = await Promise.all(requests);
  const success = results.filter(r => r.status === 201);
  const conflict = results.filter(r => r.status === 409);
  expect(success).toHaveLength(1);
  expect(conflict).toHaveLength(4);
});
```

### E2E Test (Playwright)
- Flow đặt sân từ đầu đến cuối.
- Flow đăng nhập / đăng ký.
- Demo 2 trình duyệt đặt cùng block (chỉ 1 thành công).

### Coverage Target
- BE (booking, pricing, auth): ≥ 80%
- FE: ≥ 60%

## Logging

- BE: Dùng `NestJS Logger`, không `console.log`.
- FE: Không log trong production. Dùng Sentry cho error tracking.
- Không log: password, token, thông tin thẻ, PII nhạy cảm.
