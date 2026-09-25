import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./AuthGuard";
import { AuthorizationCodeService } from "./codes/AuthorizationCodeService";
import { UserDirectoryService } from "./users/UserDirectoryService";
import { BeginSignInController } from "./controllers/BeginSignInController";
import { CompleteSignInController } from "./controllers/CompleteSignInController";
import { OidcProviderRegistry } from "./providers/OidcProviderRegistry";
import { ProviderLoginService } from "./providers/ProviderLoginService";
import { DescribeJsonWebKeySetController } from "./tokens/controllers/DescribeJsonWebKeySetController";
import { SigningKeyService } from "./tokens/SigningKeyService";
import { ServiceIdentityService } from "./services/ServiceIdentityService";

/** Authentication for both listeners (ADR 0018), as the global guard. */
@Global()
@Module({
  controllers: [
    BeginSignInController,
    CompleteSignInController,
    DescribeJsonWebKeySetController,
  ],
  providers: [
    AuthorizationCodeService,
    OidcProviderRegistry,
    ProviderLoginService,
    SigningKeyService,
    ServiceIdentityService,
    UserDirectoryService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [
    AuthorizationCodeService,
    ServiceIdentityService,
    SigningKeyService,
    UserDirectoryService,
  ],
})
export class AuthModule {}
