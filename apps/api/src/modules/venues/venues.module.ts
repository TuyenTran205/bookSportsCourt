import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { UploadsModule } from "../uploads/uploads.module.js";
import { VenuesController } from "./venues.controller.js";
import { VenuesRepository } from "./venues.repository.js";
import { VenuesService } from "./venues.service.js";
import {
  VenueExtensionsController,
  OwnerVenueSettingsController,
} from "./venues-extensions.controller.js";
import { VenuesModerationController } from "./venues-moderation.controller.js";
import {
  OwnerVenuesController,
  AdminVenuesController,
  PublicVenuesController,
} from "./venues-read.controller.js";

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [
    VenueExtensionsController,
    OwnerVenueSettingsController,
    VenuesController,
    VenuesModerationController,
    OwnerVenuesController,
    AdminVenuesController,
    PublicVenuesController,
  ],
  providers: [VenuesRepository, VenuesService],
  exports: [VenuesRepository, VenuesService],
})
export class VenuesModule {}
