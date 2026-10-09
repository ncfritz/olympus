import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DescribeCurrentUserController } from "./controllers/DescribeCurrentUserController";
import { EndSessionController } from "./controllers/EndSessionController";
import { LoginCallbackController } from "./controllers/LoginCallbackController";
import { LoginController } from "./controllers/LoginController";
import { JwtAuthGuard } from "./guards/JwtAuthGuard";
import { OlympusApiService } from "./services/OlympusApiService";
import { OlympusTokenVerifier } from "./services/OlympusTokenVerifier";
import { SessionService } from "./services/SessionService";
import { SignInService } from "./services/SignInService";

/**
 * Signing in through Olympus (ADR 0029): the console's sign-in, the
 * session cookies, and the guard every route is behind.
 */
@Module({
  controllers: [
    LoginController,
    LoginCallbackController,
    DescribeCurrentUserController,
    EndSessionController,
  ],
  providers: [
    OlympusApiService,
    OlympusTokenVerifier,
    SignInService,
    SessionService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [OlympusApiService],
})
export class AuthModule {}
