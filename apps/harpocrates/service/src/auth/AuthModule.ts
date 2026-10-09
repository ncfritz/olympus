import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./guards/AuthGuard";
import { AccessTokenService } from "./services/AccessTokenService";

/** Users' access tokens, verified against the API's keys (ADR 0018, 0020). */
@Global()
@Module({
  providers: [AccessTokenService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AccessTokenService],
})
export class AuthModule {}
