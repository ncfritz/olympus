import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./AuthGuard";
import { ServiceIdentityService } from "./services/ServiceIdentityService";

/** Authentication for both listeners (ADR 0018), as the global guard. */
@Global()
@Module({
  providers: [
    ServiceIdentityService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [ServiceIdentityService],
})
export class AuthModule {}
