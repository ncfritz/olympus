import { ConsoleSessionModule } from "@ncfritz/olympus-nest";
import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { authConfig, type AuthConfigType } from "../config/configuration";
import { COOKIE_PREFIX, DEVICE_NAME, OLYMPUS_CLIENT_ID } from "./consoleSignIn";
import { DescribeCurrentUserController } from "./controllers/DescribeCurrentUserController";
import { EndSessionController } from "./controllers/EndSessionController";
import { LoginCallbackController } from "./controllers/LoginCallbackController";
import { LoginController } from "./controllers/LoginController";
import { AuthGuard } from "./guards/AuthGuard";
import { AccessTokenService } from "./services/AccessTokenService";
import { ConsoleAuthService } from "./services/ConsoleAuthService";

/**
 * Users' access tokens, verified against the API's keys (ADR 0018, 0020),
 * as Bearer headers or, for the CA console, its session cookies; and the
 * console's sign-in through Olympus (ADR 0029, 0032).
 */
@Global()
@Module({
  imports: [
    // The sign-in itself is shared with the calendar's console. Without
    // OLYMPUS_API_URL it is never used: ConsoleAuthService answers 503 and
    // the guard takes Bearer tokens only.
    ConsoleSessionModule.forRootAsync({
      inject: [authConfig.KEY],
      useFactory: (auth: AuthConfigType) => ({
        clientId: OLYMPUS_CLIENT_ID,
        deviceName: DEVICE_NAME,
        cookiePrefix: COOKIE_PREFIX,
        baseUrl: auth.console?.baseUrl ?? "http://localhost",
        webAppUrl: auth.console?.webAppUrl,
        olympus: auth.console?.olympus ?? { apiUrl: "", signInUrl: "" },
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
    AccessTokenService,
    ConsoleAuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AccessTokenService],
})
export class AuthModule {}
