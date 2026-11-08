import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { fileURLToPath } from "node:url";

import { AuthModule } from "./modules/auth/auth.module.js";
import { BookingsModule } from "./modules/bookings/bookings.module.js";
import { CatalogsModule } from "./modules/catalogs/catalogs.module.js";
import { CourtsModule } from "./modules/courts/courts.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { OwnerApplicationsModule } from "./modules/owner-applications/owner-applications.module.js";
import { VenuesModule } from "./modules/venues/venues.module.js";
import { SchedulesModule } from "./schedules/schedules.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { validateConfig } from "./config/app-config.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        fileURLToPath(new URL("../../../.env.local", import.meta.url)),
        fileURLToPath(new URL("../../../.env", import.meta.url)),
      ],
      validate: validateConfig,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CatalogsModule,
    OwnerApplicationsModule,
    VenuesModule,
    CourtsModule,
    BookingsModule,
    SchedulesModule,
  ],
})
export class AppModule {}
