import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { VenuesModule } from "../venues/venues.module.js";
import { CourtsController } from "./courts.controller.js";
import { CourtsService } from "./courts.service.js";
import { CourtsRepository } from "./courts.repository.js";

@Module({
  imports: [AuthModule, VenuesModule],
  controllers: [CourtsController],
  providers: [CourtsService, CourtsRepository],
  exports: [CourtsService, CourtsRepository],
})
export class CourtsModule {}
