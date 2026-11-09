import {
  Module,
  type NestModule,
  type MiddlewareConsumer,
} from "@nestjs/common";
import { sessionScope } from "./session-context.js";
import { GoogleOAuthController } from "./google-oauth.controller.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { GoogleOAuthRepository } from "./google-oauth.repository.js";
import { GoogleIdentityProvider } from "./google-identity.provider.js";
import { MailModule } from "../mail/mail.module.js";
import { RealtimeSessionsService } from "./realtime-sessions.service.js";
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
import { RequestOriginGuard } from "../../common/guards/request-origin.guard.js";

@Module({
  imports: [MailModule],
  controllers: [AuthController, CurrentUserController, GoogleOAuthController],
  providers: [
    GoogleOAuthService,
    GoogleOAuthRepository,
    GoogleIdentityProvider,
    RealtimeSessionsService,
    AuthService,
    RequestOriginGuard,
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
    RealtimeSessionsService,
    RequestOriginGuard,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    OwnershipGuard,
    OwnershipService,
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(sessionScope).forRoutes("*");
  }
}
