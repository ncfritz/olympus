import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { Public } from "../authDecorators";
import { AUTH_LIMITS, RateLimited } from "../limits/rateLimits";
import { AuthorizationCodeService } from "../codes/AuthorizationCodeService";
import { ProviderLoginService } from "../providers/ProviderLoginService";
import { UserDirectoryService } from "../users/UserDirectoryService";

/**
 * Where the provider sends the browser back.
 *
 * By the time anything here can fail, the client's `redirect_uri` has
 * already been validated — it came out of the pending authorization, which
 * only exists because `BeginSignIn` checked it. So failures from here *are*
 * reported by redirecting, which is what lets the site show a sign-in error
 * instead of a bare 400.
 *
 * What is never reported to the browser is *why*. "No user with that email"
 * and "the provider rejected the code" are the same `access_denied` to the
 * client and two different lines in the log: the difference tells an
 * attacker whether an address is one of ours.
 */
@Controller({ path: "auth", version: "1" })
export class CompleteSignInController {
  private readonly logger = new Logger(CompleteSignInController.name);

  constructor(
    private readonly codes: AuthorizationCodeService,
    private readonly login: ProviderLoginService,
    private readonly users: UserDirectoryService,
  ) {}

  @Get("/callback/:provider")
  @Public()
  @RateLimited(AUTH_LIMITS.completeSignIn)
  @ApiOperation({
    summary: "Completes a sign-in",
    description:
      "The identity provider's redirect. Exchanges the provider's code, resolves the user, and redirects back to the client with an authorization code — or with `error=access_denied` if the person may not sign in.",
    operationId: "CompleteSignIn",
    tags: ["Authentication"],
  })
  @ApiParam({ name: "provider", required: true })
  @ApiResponse({ status: 302, description: "Back to the client." })
  @ApiResponse({
    status: 400,
    description:
      "There is no pending sign-in for this state, so there is nowhere safe to redirect to.",
  })
  @ApiResponse({
    status: 429,
    description: "Over the rate limit; `Retry-After` says for how long.",
  })
  async handle(
    @Param("provider") provider: string,
    @Query("state") state: string | undefined,
    @Query("error") providerError: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (state === undefined || state === "") {
      throw new BadRequestException("state is required");
    }
    // No pending authorization means no validated redirect_uri, so there is
    // nothing to bounce the browser to. This is also what a replayed
    // callback hits, because taking it removes it.
    const pending = this.codes.takeAuthorization(state);
    if (pending === undefined) {
      throw new BadRequestException("no sign-in is pending for that state");
    }
    // The state was issued for one provider; arriving at another's callback
    // with it means the legs have been crossed.
    if (pending.provider !== provider) {
      throw new BadRequestException("that state belongs to another provider");
    }

    const back = (params: Record<string, string>): void => {
      const target = new URL(pending.redirectUri);
      for (const [key, value] of Object.entries(params)) {
        target.searchParams.set(key, value);
      }
      // The client's own state, returned untouched: it is how the client
      // knows this is the sign-in it started.
      target.searchParams.set("state", pending.clientState);
      response.redirect(target.href);
    };

    if (providerError !== undefined) {
      // Someone declining a consent screen is the ordinary case.
      this.logger.log(`${provider} returned ${providerError}`);
      back({ error: "access_denied" });
      return;
    }

    const result = await this.login.complete(provider, request.originalUrl, {
      verifier: pending.providerVerifier,
      nonce: pending.providerNonce,
      state,
    });
    if ("reason" in result) {
      this.logger.warn(`sign-in refused: ${result.reason}`);
      back({ error: "access_denied" });
      return;
    }

    const resolution = await this.users.resolve(result.identity);
    if ("reason" in resolution) {
      this.logger.warn(`sign-in refused: ${resolution.reason}`);
      back({ error: "access_denied" });
      return;
    }

    const code = this.codes.issueCode({
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      userId: resolution.user.id,
      authTime: Math.floor(Date.now() / 1000),
    });
    this.logger.log(
      `signed in ${resolution.user.id} for ${pending.clientId} via ${provider}`,
    );
    back({ code });
  }
}
