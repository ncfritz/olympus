import { Module } from "@nestjs/common";
import { authConfig, type AuthConfigType } from "../config/configuration";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AllowlistService } from "./services/AllowlistService";
import { DescribeCurrentUserController } from "./controllers/DescribeCurrentUserController";
import { EndSessionController } from "./controllers/EndSessionController";
import { LoginCallbackController } from "./controllers/LoginCallbackController";
import { LoginController } from "./controllers/LoginController";
import { RefreshAccessTokenController } from "./controllers/RefreshAccessTokenController";
import { LoginService } from "./services/LoginService";
import { AuthTokenService } from "./services/AuthTokenService";
import { JwtAuthGuard } from "./guards/JwtAuthGuard";
import { OidcProviderRegistry } from "./services/OidcProviderRegistry";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (auth: AuthConfigType) => ({ secret: auth.jwtSecret }),
      inject: [authConfig.KEY],
    }),
  ],
  controllers: [
    LoginController,
    LoginCallbackController,
    DescribeCurrentUserController,
    RefreshAccessTokenController,
    EndSessionController,
  ],
  providers: [
    OidcProviderRegistry,
    AllowlistService,
    AuthTokenService,
    LoginService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AllowlistService],
})
export class AuthModule {}
