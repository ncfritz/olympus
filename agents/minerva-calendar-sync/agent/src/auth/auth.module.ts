import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AllowlistService } from "./allowlist.service";
import { AuthController } from "./auth.controller";
import { AuthTokenService } from "./auth-token.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { OidcProviderRegistry } from "./oidc-provider-registry";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("AUTH_JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    OidcProviderRegistry,
    AllowlistService,
    AuthTokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AllowlistService],
})
export class AuthModule {}
