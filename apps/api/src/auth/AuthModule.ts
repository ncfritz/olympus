import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./AuthGuard";
import { AuthorizationCodeService } from "./codes/AuthorizationCodeService";
import { DescribeJsonWebKeySetController } from "./tokens/controllers/DescribeJsonWebKeySetController";
import { SigningKeyService } from "./tokens/SigningKeyService";
import { ServiceIdentityService } from "./services/ServiceIdentityService";

/** Authentication for both listeners (ADR 0018), as the global guard. */
@Global()
@Module({
  controllers: [DescribeJsonWebKeySetController],
  providers: [
    AuthorizationCodeService,
    SigningKeyService,
    ServiceIdentityService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [
    AuthorizationCodeService,
    ServiceIdentityService,
    SigningKeyService,
  ],
})
export class AuthModule {}
