import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { BookingsModule } from "../bookings/bookings.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { BlackoutsController } from "./blackouts.controller.js";
import { OwnerController } from "./owner.controller.js";
import { OwnerRepository } from "./owner.repository.js";
import { OwnerService } from "./owner.service.js";

@Module({
  imports: [AuthModule, BookingsModule, RealtimeModule],
  controllers: [OwnerController, BlackoutsController],
  providers: [OwnerRepository, OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}