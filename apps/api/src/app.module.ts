import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { fileURLToPath } from "node:url";

import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";
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
  ],
})
export class AppModule {}
