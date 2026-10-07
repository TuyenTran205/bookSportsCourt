# 10 – Quy ước Backend

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-07

## Cấu trúc module NestJS

```
apps/api/src/
├── main.ts                     # Bootstrap, Swagger, CORS, Validation pipe
├── app.module.ts               # Root module
├── common/
│   ├── filters/                # GlobalExceptionFilter
│   ├── guards/                 # JwtAuthGuard, RolesGuard, OwnershipGuard
│   ├── decorators/             # @Roles(), @CurrentUser(), @CheckOwnership()
│   ├── interceptors/           # LoggingInterceptor, TransformResponseInterceptor
│   └── pipes/                  # ZodValidationPipe
├── config/                     # ConfigModule (env validation với Zod)
├── database/
│   ├── schema/                 # Drizzle schema files (id: uuid().primaryKey().$defaultFn(() => v7()), ADR-011)
│   ├── migrations/             # SQL migration files
│   └── database.module.ts
├── modules/
│   ├── auth/                   # AuthModule: đăng nhập, token, OAuth
│   ├── users/                  # UsersModule: CRUD user, hồ sơ
│   ├── venues/                 # VenuesModule: CRUD venue, duyệt
│   ├── courts/                 # CourtsModule: CRUD court, giờ mở cửa
│   ├── pricing/                # PricingModule: pricing rules
│   ├── bookings/               # BookingsModule: hold, cancel
│   ├── payments/               # PaymentsModule: QR chuyển khoản, upload ảnh, Owner duyệt
│   ├── realtime/               # RealtimeModule: Socket.IO gateway
│   ├── reviews/                # ReviewsModule
│   ├── notifications/          # NotificationsModule
│   └── admin/                  # AdminModule: duyệt, thống kê, audit
└── schedules/                  # Cron jobs (@nestjs/schedule)
    └── expire-holds.schedule.ts
```

## Controller mỏng – Quy tắc vàng

```typescript
// ✅ ĐÚNG – Controller chỉ nhận/trả HTTP, delegate cho service
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
async createHold(
  @Body() dto: CreateHoldDto,
  @CurrentUser() user: User,
): Promise<BookingResponse> {
  return this.bookingsService.createHold(dto, user.id);
}

// ❌ SAI – Nghiệp vụ trong controller
@Post()
async createHold(@Body() dto: CreateHoldDto) {
  const court = await this.db.select().from(courts).where(...);
  if (court.status !== 'active') throw new BadRequestException(...);
  // ... logic dài trong controller
}
```

## Service / Repository Pattern

```typescript
// Service: chứa nghiệp vụ, orchestrate
@Injectable()
export class BookingsService {
  constructor(
    private readonly bookingsRepo: BookingsRepository,
    private readonly pricingService: PricingService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createHold(dto: CreateHoldDto, customerId: string): Promise<Booking> {
    // Nghiệp vụ ở đây
  }
}

// Repository: chỉ tương tác DB
@Injectable()
export class BookingsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  async insert(data: NewBooking): Promise<Booking> {
    const [booking] = await this.db.insert(bookings).values(data).returning();
    return booking;
  }
}
```

## DTO + Zod Validation

```typescript
// packages/shared/src/schemas/booking.schema.ts
export const CreateHoldSchema = z.object({
  courtId: z.string().uuid(),
  start:   z.string().datetime(),  // ISO 8601 UTC
  end:     z.string().datetime(),
}).refine(
  (d) => isMultipleOf30Minutes(d.start) && isMultipleOf30Minutes(d.end),
  { message: "Thời gian phải là bội số 30 phút" }
);

// apps/api/src/modules/bookings/dto/create-hold.dto.ts
export type CreateHoldDto = z.infer<typeof CreateHoldSchema>;
```

## Transaction

```typescript
// Dùng Drizzle transaction cho các thao tác multi-step
async createHold(dto: CreateHoldDto, customerId: string) {
  return this.db.transaction(async (tx) => {
    // 1. Expire old holds trong cùng transaction
    await tx.update(bookings)...

    // 2. Tạo booking mới (EXCLUDE constraint sẽ từ chối nếu trùng)
    const [booking] = await tx.insert(bookings)...

    return booking;
  });
}
```

## Logging

```typescript
// Dùng NestJS Logger (không dùng console.log trực tiếp)
private readonly logger = new Logger(BookingsService.name);

this.logger.log(`Hold created: ${booking.id} by user ${customerId}`);
this.logger.error(`Hold failed: ${error.message}`, error.stack);
```

**Quy tắc:**
- `log`: hành động thành công quan trọng (booking, payment, auth).
- `warn`: trường hợp không mong đợi nhưng không crash.
- `error`: exception với stack trace.
- Không log PII (password, token, thông tin thanh toán nhạy cảm).

## Xử lý lỗi

```typescript
// GlobalExceptionFilter bắt tất cả exception và trả format chuẩn
// Xem chi tiết format lỗi trong 11-api-contract.md

// Service ném exception NestJS
throw new NotFoundException('Venue không tồn tại');
throw new ConflictException({ code: 'BOOKING_CONFLICT', message: 'Slot đã được đặt' });
throw new ForbiddenException('Bạn không có quyền thao tác trên venue này');
```

## Config qua env

```typescript
// config/app.config.ts – validate env khi startup
const AppConfigSchema = z.object({
  DATABASE_URL:       z.string().url(),
  JWT_ACCESS_SECRET:  z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT:               z.coerce.number().default(3001),
  // ...
});

// Nếu env sai → app crash ngay khi start (fail fast)
```

## OpenAPI (Swagger)

- Thêm `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` đầy đủ vào mọi endpoint.
- Dùng `@ApiProperty()` trên mọi DTO field.
- Swagger UI tại `/api/docs` (chỉ bật ở dev/staging).
- **Quy tắc:** Cập nhật OpenAPI TRƯỚC khi chia việc FE/BE.
