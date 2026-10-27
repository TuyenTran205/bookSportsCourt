import { Module } from "@nestjs/common";
import { AuthController, CurrentUserController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthJwtService } from "./auth-jwt.service.js";
import { AuthMailService } from "./auth-mail.service.js";
import { AuthCookies, AuthRequestGuard } from "./auth-http.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { OwnershipGuard } from "../../common/guards/ownership.guard.js";
import { OwnershipService } from "./ownership.service.js";
import { OwnershipRepository } from "./ownership.repository.js";

@Module({
  controllers: [AuthController, CurrentUserController],
  providers: [
    AuthService,
    AuthRepository,
    AuthJwtService,
    AuthMailService,
    AuthCookies,
    AuthRequestGuard,
    JwtAuthGuard,
    RolesGuard,
    OwnershipGuard,
    OwnershipService,
    OwnershipRepository,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    OwnershipGuard,
    OwnershipService,
  ],
})
export class AuthModule {}
