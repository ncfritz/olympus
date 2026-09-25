import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Logger,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { type Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { Public } from "../authDecorators";
import { resolveClients } from "../clients/clients";
import { AuthorizationCodeService } from "../codes/AuthorizationCodeService";
import { CODE_CHALLENGE_METHOD } from "../codes/pkce";
import { OidcProviderRegistry } from "../providers/OidcProviderRegistry";
import { ProviderLoginService } from "../providers/ProviderLoginService";

/** base64url, and the length SHA-256 produces. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Starts a sign-in: validates what the client asked for, then sends the
 * browser to the provider.
 *
 * **Nothing here redirects to a `redirect_uri` that has not been validated.**
 * That is the whole reason the order below is what it is: an unknown client
 * or an unregistered redirect URI is answered with a 400, never by bouncing
 * the browser somewhere. Once the URI *is* known to belong to the client, a
 * later failure can be reported to it — that is what the callback does.
 */
@Controller({ path: "auth", version: "1" })
export class BeginSignInController {
  private readonly logger = new Logger(BeginSignInController.name);

  constructor(
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
    private readonly codes: AuthorizationCodeService,
    private readonly providers: OidcProviderRegistry,
    private readonly login: ProviderLoginService,
  ) {}

  @Get("/authorize")
  @Public()
  @ApiOperation({
    summary: "Begins a sign-in",
    description:
      "Validates the client's authorization request and redirects the browser to the identity provider. The authorization-code flow with PKCE; every client is public, so `code_challenge` is required and only S256 is accepted.",
    operationId: "BeginSignIn",
    tags: ["Authentication"],
  })
  @ApiQuery({ name: "client_id", required: true })
  @ApiQuery({ name: "redirect_uri", required: true })
  @ApiQuery({ name: "response_type", required: true, enum: ["code"] })
  @ApiQuery({ name: "code_challenge", required: true })
  @ApiQuery({
    name: "code_challenge_method",
    required: true,
    enum: [CODE_CHALLENGE_METHOD],
  })
  @ApiQuery({ name: "state", required: true })
  @ApiQuery({ name: "provider", required: true })
  @ApiResponse({ status: 302, description: "To the identity provider." })
  @ApiResponse({
    status: 400,
    description:
      "The request is not one this client registered. Deliberately not a redirect: an unvalidated redirect_uri is an open redirect.",
  })
  async handle(
    @Query("client_id") clientId: string | undefined,
    @Query("redirect_uri") redirectUri: string | undefined,
    @Query("response_type") responseType: string | undefined,
    @Query("code_challenge") codeChallenge: string | undefined,
    @Query("code_challenge_method") method: string | undefined,
    @Query("state") state: string | undefined,
    @Query("provider") provider: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    // 1. The client, and 2. its redirect URI: both before anything can be
    // reported by redirecting.
    const clients = resolveClients(this.auth.users.clientOrigins);
    const client = clientId === undefined ? undefined : clients.get(clientId);
    if (client === undefined) {
      throw new BadRequestException("unknown client_id");
    }
    if (redirectUri === undefined || !client.accepts(redirectUri)) {
      throw new BadRequestException("redirect_uri is not registered");
    }

    // 3. The rest of the request. Still a 400 rather than a redirect: a
    // malformed request is a broken client, and reporting it plainly is more
    // use than a redirect loop.
    if (responseType !== "code") {
      throw new BadRequestException("response_type must be code");
    }
    if (method !== CODE_CHALLENGE_METHOD) {
      throw new BadRequestException(
        `code_challenge_method must be ${CODE_CHALLENGE_METHOD}`,
      );
    }
    if (codeChallenge === undefined || !CHALLENGE.test(codeChallenge)) {
      throw new BadRequestException("code_challenge must be an S256 challenge");
    }
    if (state === undefined || state === "") {
      throw new BadRequestException("state is required");
    }
    if (
      provider === undefined ||
      this.providers.config(provider) === undefined
    ) {
      throw new BadRequestException("unknown provider");
    }

    const leg = await this.login.begin(provider);
    this.codes.rememberAuthorization(leg.state, {
      clientId: client.id,
      redirectUri,
      clientState: state,
      codeChallenge,
      provider,
      providerVerifier: leg.verifier,
      providerNonce: leg.nonce,
    });
    this.logger.log(`sign-in for ${client.id} via ${provider}`);
    response.redirect(leg.url);
  }
}
