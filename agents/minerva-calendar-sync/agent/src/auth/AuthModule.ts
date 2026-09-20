import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AllowlistService } from "./services/AllowlistService";
import { AuthController } from "./controllers/AuthController";
import { AuthTokenService } from "./services/AuthTokenService";
import { JwtAuthGuard } from "./guards/JwtAuthGuard";
import { OidcProviderRegistry } from "./services/OidcProviderRegistry";

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
