import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import {
  BookingsController,
  OwnerBookingsController,
  VenuesSlotsController,
} from "./bookings.controller.js";
import { BookingsRepository } from "./bookings.repository.js";
import { BookingsService } from "./bookings.service.js";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    VenuesSlotsController,
    BookingsController,
    OwnerBookingsController,
  ],
  providers: [BookingsRepository, BookingsService],
  exports: [BookingsService, BookingsRepository],
})
export class BookingsModule {}
