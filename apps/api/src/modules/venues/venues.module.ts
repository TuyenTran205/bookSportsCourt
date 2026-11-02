import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CatalogsModule } from "../catalogs/catalogs.module.js";
import { OwnerVenuesController, VenuesController } from "./venues.controller.js";
import { VenuesService } from "./venues.service.js";
import { VenuesRepository } from "./venues.repository.js";

@Module({
  imports: [AuthModule, CatalogsModule],
  controllers: [VenuesController, OwnerVenuesController],
  providers: [VenuesService, VenuesRepository],
  exports: [VenuesService, VenuesRepository],
})
export class VenuesModule {}

