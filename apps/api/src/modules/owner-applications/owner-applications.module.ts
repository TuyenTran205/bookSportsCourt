import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OwnerApplicationsController } from "./owner-applications.controller.js";
import { OwnerApplicationsService } from "./owner-applications.service.js";
import { OwnerApplicationsRepository } from "./owner-applications.repository.js";

@Module({
  imports: [AuthModule],
  controllers: [OwnerApplicationsController],
  providers: [OwnerApplicationsService, OwnerApplicationsRepository],
  exports: [OwnerApplicationsService, OwnerApplicationsRepository],
})
export class OwnerApplicationsModule {}

