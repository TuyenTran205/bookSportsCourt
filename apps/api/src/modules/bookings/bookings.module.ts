import { Module } from "@nestjs/common";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard.js";
import { AuthModule } from "../auth/auth.module.js";
import { BookingsScheduleService } from "./bookings-schedule.service.js";
import { BookingsController } from "./bookings.controller.js";
import { BookingsRepository } from "./bookings.repository.js";
import { BookingsService } from "./bookings.service.js";

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [
    BookingsRepository,
    BookingsService,
    BookingsScheduleService,
    OptionalJwtAuthGuard,
  ],
  exports: [BookingsService, BookingsRepository, BookingsScheduleService],
})
export class BookingsModule {}
