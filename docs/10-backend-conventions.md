# 10 – Quy ước Backend

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-10-12

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
│   ├── favorites/              # FavoritesModule: yêu thích venue (CUS-11)
│   ├── owner-applications/     # OwnerApplicationsModule: đăng ký làm chủ sân
│   ├── catalogs/               # CatalogsModule: areas, sports, amenities (public read + Admin CRUD)
│   ├── reports/                # ReportsModule: doanh thu, thống kê cho Owner (OWN-11)
│   ├── uploads/                # UploadsModule: presigned URL cho R2
│   ├── health/                 # HealthModule: GET /health (không auth) – dùng cho keep-alive
│   └── admin/                  # AdminModule: duyệt, thống kê, audit
└── schedules/                  # Cron jobs (@nestjs/schedule)
    ├── expire-holds.schedule.ts            # Mỗi phút  – held quá hạn → expired
    ├── auto-complete-bookings.schedule.ts  # Mỗi 5 phút – confirmed qua giờ → completed
    ├── cancel-stale-payments.schedule.ts   # Mỗi 5 phút – pending_payment quá hạn duyệt → cancelled
    ├── send-reminders.schedule.ts          # Mỗi 15 phút – nhắc lịch trước 24h (CUS-14)
    └── cleanup-expired-data.schedule.ts    # Hằng ngày 03:00 – dọn auth_tokens/notifications/audit_logs (xem 04)
```

> Mọi nhóm endpoint trong [11-api-contract.md](11-api-contract.md) phải có module tương ứng ở đây. `favorites`, `owner-applications`, `catalogs`, `reports`, `uploads`, `health` từng có endpoint trong hợp đồng API nhưng không xuất hiện trong cấu trúc thư mục — thiếu module nghĩa là không ai biết code đó đặt ở đâu.
>
> **`catalogs`** gộp ba bảng danh mục (`areas`, `sports`, `amenities`) vào một module vì chúng cùng hình dạng: đọc công khai, chỉ Admin ghi. Tách ba module gần như trùng lặp là thừa.
>
> **`health`** phải **không** yêu cầu auth và không chạm DB nặng (chỉ `SELECT 1`) — `keep-alive.yml` gọi nó mỗi 10 phút, và endpoint này cũng là thứ giữ Neon không bị pause.
>
> Năm cron này khớp với mục "Cron" trong [05-booking-and-realtime.md](05-booking-and-realtime.md). Thiếu `auto-complete-bookings` thì trạng thái `completed` không bao giờ đạt được, kéo theo CUS-13 (đánh giá) và OWN-09 (no-show) không dùng được.

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
