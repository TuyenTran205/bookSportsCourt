import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { VenuesController } from "./venues.controller.js";
import { VenuesRepository } from "./venues.repository.js";
import { VenuesService } from "./venues.service.js";
import { VenuesModerationController } from "./venues-moderation.controller.js";
import {
  OwnerVenuesController,
  AdminVenuesController,
  PublicVenuesController,
} from "./venues-read.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [
    VenuesController,
    VenuesModerationController,
    OwnerVenuesController,
    AdminVenuesController,
    PublicVenuesController,
  ],
  providers: [VenuesRepository, VenuesService],
})
export class VenuesModule {}
