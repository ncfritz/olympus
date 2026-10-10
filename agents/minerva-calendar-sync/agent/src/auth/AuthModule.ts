import { ConsoleSessionModule } from "@ncfritz/olympus-nest";
import { Module } from "@nestjs/common";
import { authConfig, type AuthConfigType } from "../config/configuration";
import { COOKIE_PREFIX, DEVICE_NAME, OLYMPUS_CLIENT_ID } from "./authConstants";
import { APP_GUARD } from "@nestjs/core";
import { DescribeCurrentUserController } from "./controllers/DescribeCurrentUserController";
import { EndSessionController } from "./controllers/EndSessionController";
import { LoginCallbackController } from "./controllers/LoginCallbackController";
import { LoginController } from "./controllers/LoginController";
import { JwtAuthGuard } from "./guards/JwtAuthGuard";
import { OlympusApiService } from "./services/OlympusApiService";
import { OlympusTokenVerifier } from "./services/OlympusTokenVerifier";
import { SessionService } from "./services/SessionService";

/**
 * Signing in through Olympus (ADR 0029): the console's sign-in, the
 * session cookies, and the guard every route is behind.
 */
@Module({
  imports: [
    // The sign-in itself is shared with Harpocrates's console.
    ConsoleSessionModule.forRootAsync({
      inject: [authConfig.KEY],
      useFactory: (auth: AuthConfigType) => ({
        clientId: OLYMPUS_CLIENT_ID,
        deviceName: DEVICE_NAME,
        cookiePrefix: COOKIE_PREFIX,
        baseUrl: auth.baseUrl,
        webAppUrl: auth.webAppUrl,
        olympus: auth.olympus,
      }),
    }),
  ],
  controllers: [
    LoginController,
    LoginCallbackController,
    DescribeCurrentUserController,
    EndSessionController,
  ],
  providers: [
    OlympusApiService,
    OlympusTokenVerifier,
    SessionService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [OlympusApiService, ConsoleSessionModule],
})
export class AuthModule {}
