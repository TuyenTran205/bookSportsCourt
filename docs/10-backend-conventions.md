# 10 – Quy ước Backend

> **Phiên bản:** 1.4.0 | **Cập nhật lần cuối:** 2026-11-21

## Cấu trúc module NestJS

```
apps/api/src/
├── main.ts                     # Bootstrap, Swagger, CORS, Validation pipe, IoAdapter
├── app.module.ts               # Root module
├── common/
│   ├── filters/                # GlobalExceptionFilter
│   ├── guards/                 # JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard, OwnershipGuard, RequestOriginGuard
│   │                           # (AuthRequestGuard nằm trong modules/auth/auth-http.ts; ProofAccessGuard trong modules/payments/)
│   ├── decorators/             # @Roles(), @CurrentUser(), @CheckOwnership()
│   ├── interceptors/           # LoggingInterceptor, TransformResponseInterceptor
│   └── pipes/                  # ZodValidationPipe
├── config/                     # ConfigModule: app-config.ts, mail-config.ts, http-security.ts, allowed-origins.ts
├── database/
│   ├── schema/                 # Drizzle schema: schema.ts, index.ts (id: uuid().primaryKey().$defaultFn(() => v7()), ADR-011)
│   ├── migrations/             # SQL migration files (0001..0016)
│   └── database.module.ts
├── modules/
│   ├── auth/                   # AuthModule: đăng nhập, token, Google OAuth, ws-token, RealtimeSessionsService
│   ├── users/                  # UsersModule: Admin list/detail/suspend user
│   ├── venues/                 # VenuesModule: CRUD venue, duyệt, ảnh, chính sách huỷ/thanh toán
│   ├── courts/                 # CourtsModule: CRUD court, giờ mở cửa, pricing_rules, blackouts
│   ├── pricing/                # (Chỉ giữ .gitkeep; CRUD pricing_rules ở modules/courts/, tính giá ở modules/bookings/)
│   ├── bookings/               # BookingsModule: slots, quote, hold, cancel, no-show, owner timeline/bookings/reports
│   ├── payments/               # PaymentsModule: QR chuyển khoản, upload ảnh proof, Owner duyệt/từ chối
│   ├── realtime/               # RealtimeModule: RealtimeGateway (/ws), RealtimeOutboxService (@Interval(5000)), RealtimePublisher
│   ├── reviews/                # ReviewsModule: tạo/xem/ẩn-hiện, Owner xem/trả lời/báo cáo review, Admin duyệt báo cáo
│   ├── notifications/          # NotificationsModule: danh sách, đếm chưa đọc, đánh dấu đã đọc
│   ├── favorites/              # FavoritesModule: yêu thích venue (CUS-12)
│   ├── owner-applications/     # OwnerApplicationsModule: đăng ký làm chủ sân & Admin duyệt
│   ├── owner/                  # OwnerModule: OwnerController, BlackoutsController, OwnerService
│   ├── catalogs/               # CatalogsModule & LocationsController: areas, sports, amenities, ĐVHC 2 cấp
│   ├── reports/                # ReportsModule: doanh thu, công suất cho Owner (OWN-11, OWN-12)
│   ├── mail/                   # BusinessMailModule / MailModule: MailTransport (Resend + Gmail SMTP), BusinessMailService (@Interval(10000))
│   ├── uploads/                # UploadsModule: dịch vụ lưu trữ nội bộ (PublicStorage, ProofStorage, ProofCleanupService @Interval(60000), xử lý ảnh bằng sharp; không có HTTP controller độc lập)
│   ├── audit/                  # AuditModule: GET /admin/audit-logs, writeAudit helper
│   ├── health/                 # HealthModule: GET /health (SELECT 1) & GET /health/ping (liveness nhanh)
│   └── admin/                  # AdminModule: AdminReportingController (bookings, stats, analytics)
└── schedules/                  # Cron jobs (@nestjs/schedule) + schedules.module.ts
    ├── expire-holds.schedule.ts            # Mỗi phút  – held quá hạn → expired
    ├── auto-complete-bookings.schedule.ts  # Mỗi 5 phút – confirmed qua giờ → completed
    ├── cancel-stale-payments.schedule.ts   # Mỗi 5 phút – pending_payment quá hạn duyệt → cancelled
    └── send-reminders.schedule.ts          # Mỗi 15 phút – nhắc lịch trước 24h (CUS-14)
```

> Lưu ý về job dọn dẹp (`cleanup-expired-data.schedule.ts`): lịch dọn hằng ngày 03:00 cho `auth_tokens`/`notifications`/`audit_logs` hiện chưa có file cron độc lập trong `schedules/`; mới có dọn `oauth_states` (`@Interval(3600000)` trong `GoogleOAuthService`) và `storage_cleanup_jobs` (`@Interval(60000)` trong `ProofCleanupService`).
>
> Mọi nhóm endpoint trong [11-api-contract.md](11-api-contract.md) đều có module tương ứng ở đây.
>
> **`catalogs`** gộp ba bảng danh mục (`areas`, `sports`, `amenities`) cùng `LocationsController` (ĐVHC 2 cấp `/provinces`, `/wards`) vào một module.
>
> **`health`** không yêu cầu auth: `GET /health` chạy `SELECT 1` giữ kết nối DB (dùng cho `keep-alive.yml` giữ Neon không bị pause), còn `GET /health/ping` trả `{ status: 'ok' }` không chạm DB.
>
> Bốn file cron trong `schedules/` kết hợp cùng các interval worker (`RealtimeOutboxService`, `BusinessMailService`, `ProofCleanupService`) bảo đảm vòng đời booking và thông báo thông suốt. Thiếu `auto-complete-bookings` thì trạng thái `completed` không bao giờ đạt được, kéo theo CUS-13 (đánh giá) và OWN-09 (no-show) không dùng được.

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
// config/app-config.ts – validate env khi startup
const AppConfigSchema = z.object({
  DATABASE_URL:       z.string().url(),
  JWT_ACCESS_SECRET:  z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ALLOWED_ORIGINS:    z.string().min(1),
  PORT:               z.coerce.number().int().min(1).max(65_535).default(3001),
  // ...
});

// Nếu env sai → app crash ngay khi start (fail fast)
```

## OpenAPI (Swagger)

**Kiểm chứng Phase4:** `pnpm --filter @bsc/api contract:check` đối chiếu snapshot runtime và metadata đã triển khai; `contract:export` xuất lại để review, `contract:final` còn yêu cầu không có route planned bị thiếu. Bước15 ghi artifact candidate và gate chưa đạt, không coi snapshot OpenAPI3 là nghiệm thu vòng đời.

**Build API:** `pnpm --filter @bsc/api build` chạy tsconfig.build.json, emit src và shared sources cần thiết vào dist, giữ cấu trúc monorepo để relative imports hoạt động. Entry JS là apps/api/dist/apps/api/src/main.js tính từ root. Inject env riêng khi chạy compiled application; không copy secret vào dist. API typecheck vẫn bao gồm scripts, build không emit scripts. Shared build hiện là kiểm tra type, không emit package JS.

- Thêm `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` đầy đủ vào mọi endpoint.
- Dùng `@ApiProperty()` trên mọi DTO field.
- Với DTO type alias suy ra từ Zod (Venue), type bị xoá ở runtime: dùng `@ApiBody({ schema })`, `@ApiQuery({ schema })`, `@ApiResponse({ schema })` tường minh thay `@ApiProperty`. Schema Swagger chỉ là metadata; validation luôn dùng shared Zod qua `ZodValidationPipe`. Test phải đối chiếu metadata với OpenAPI thiết kế để tránh lệch, không viết thêm class-validator rule trùng Zod.
- Swagger UI tại `/api/docs` (chỉ bật ở dev/staging).
- **Quy tắc:** Cập nhật OpenAPI TRƯỚC khi chia việc FE/BE.
