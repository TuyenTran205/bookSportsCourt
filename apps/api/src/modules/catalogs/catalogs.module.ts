import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CatalogsController } from "./catalogs.controller.js";
import { LocationsController } from "./locations.controller.js";
import { CatalogsService } from "./catalogs.service.js";
import { CatalogsRepository } from "./catalogs.repository.js";

@Module({
  imports: [AuthModule],
  controllers: [CatalogsController, LocationsController],
  providers: [CatalogsService, CatalogsRepository],
  exports: [CatalogsService, CatalogsRepository],
})
export class CatalogsModule {}
