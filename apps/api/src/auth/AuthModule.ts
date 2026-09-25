import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { GraphQLClientModule } from "../infra/GraphQLClientModule";
import { AuthGuard } from "./AuthGuard";
import { RateLimitGuard } from "./limits/RateLimitGuard";
import { AuthorizationCodeService } from "./codes/AuthorizationCodeService";
import { UserDirectoryService } from "./users/UserDirectoryService";
import { UserIdentityService } from "./users/UserIdentityService";
import { BeginSignInController } from "./controllers/BeginSignInController";
import { CompleteSignInController } from "./controllers/CompleteSignInController";
import { CreateTokenController } from "./controllers/CreateTokenController";
import { OidcProviderRegistry } from "./providers/OidcProviderRegistry";
import { ProviderLoginService } from "./providers/ProviderLoginService";
import { DescribeCurrentUserController } from "./controllers/DescribeCurrentUserController";
import { DescribeJsonWebKeySetController } from "./controllers/DescribeJsonWebKeySetController";
import { ListSessionsController } from "./controllers/ListSessionsController";
import { RevokeSessionController } from "./controllers/RevokeSessionController";
import { SignOutController } from "./controllers/SignOutController";
import { SigningKeyService } from "./tokens/SigningKeyService";
import { ServiceIdentityService } from "./services/ServiceIdentityService";

/** Authentication for both listeners (ADR 0018), as the global guard. */
@Global()
@Module({
  // UserDirectoryService talks to Hasura, and a global module does not
  // inherit AppModule's imports: what AuthModule needs, AuthModule imports.
  imports: [GraphQLClientModule],
  controllers: [
    BeginSignInController,
    CompleteSignInController,
    CreateTokenController,
    DescribeJsonWebKeySetController,
    // Static before parameterised, and both before /sessions/:sessionId:
    // Express tries routes in registration order.
    DescribeCurrentUserController,
    ListSessionsController,
    RevokeSessionController,
    SignOutController,
  ],
  providers: [
    AuthorizationCodeService,
    OidcProviderRegistry,
    ProviderLoginService,
    SigningKeyService,
    ServiceIdentityService,
    UserDirectoryService,
    UserIdentityService,
    // Before the authentication guard: global guards run in the order they
    // are registered, and a rate limit is worth applying before the API has
    // spent anything verifying a request.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [
    AuthorizationCodeService,
    ServiceIdentityService,
    SigningKeyService,
    UserDirectoryService,
    UserIdentityService,
  ],
})
export class AuthModule {}
