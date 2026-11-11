import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OwnerModule } from "../owner/owner.module.js";
import { ReportsController } from "./reports.controller.js";

@Module({
  imports: [AuthModule, OwnerModule],
  controllers: [ReportsController],
})
export class ReportsModule {}