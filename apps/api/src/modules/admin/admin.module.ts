import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminReportingController } from "./admin-reporting.controller.js";
import { AdminReportingRepository } from "./admin-reporting.repository.js";
import { AdminReportingService } from "./admin-reporting.service.js";
@Module({
  imports: [AuthModule],
  controllers: [AdminReportingController],
  providers: [AdminReportingService, AdminReportingRepository],
})
export class AdminModule {}
