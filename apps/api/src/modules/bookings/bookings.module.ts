import { Module } from "@nestjs/common";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard.js";
import { AuthModule } from "../auth/auth.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { BookingsScheduleService } from "./bookings-schedule.service.js";
import { BookingsController } from "./bookings.controller.js";
import { OwnerBookingsController } from "./owner-bookings.controller.js";
import { OwnerReportsController } from "./owner-reports.controller.js";
import { OwnerTimelineController } from "./owner-timeline.controller.js";
import { BookingsRepository } from "./bookings.repository.js";
import { BookingsService } from "./bookings.service.js";
import { OwnerReportingService } from "./owner-reporting.service.js";

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [
    BookingsController,
    OwnerBookingsController,
    OwnerReportsController,
    OwnerTimelineController,
  ],
  providers: [
    BookingsRepository,
    BookingsService,
    BookingsScheduleService,
    OwnerReportingService,
    OptionalJwtAuthGuard,
  ],
  exports: [
    BookingsService,
    BookingsRepository,
    BookingsScheduleService,
    OwnerReportingService,
  ],
})
export class BookingsModule {}
