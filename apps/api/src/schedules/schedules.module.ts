import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "../database/database.module.js";
import { ExpireHoldsSchedule } from "./expire-holds.schedule.js";
import { AutoCompleteBookingsSchedule } from "./auto-complete-bookings.schedule.js";

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule],
  providers: [ExpireHoldsSchedule, AutoCompleteBookingsSchedule],
  exports: [ExpireHoldsSchedule, AutoCompleteBookingsSchedule],
})
export class SchedulesModule {}
