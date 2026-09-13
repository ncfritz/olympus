import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { AllowlistService } from "./allowlist.service";
import { AuthTokenService } from "./auth-token.service";
import { AuthUser } from "./auth-user";
import { ACCESS_TOKEN_COOKIE, OIDC_TXN_COOKIE } from "./auth.constants";
import { CurrentUser } from "./current-user.decorator";
import { RefreshDto } from "./dto/refresh.dto";
import { OidcProviderRegistry } from "./oidc-provider-registry";
import { loadOpenIdClient } from "./openid-client-loader";
import { Public } from "./public.decorator";

const OIDC_TXN_COOKIE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_COOKIE_TTL_MS = 60 * 60 * 1000;

interface OidcTransaction {
  provider: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  private readonly baseUrl: string;

  constructor(
    private readonly providers: OidcProviderRegistry,
    private readonly allowlist: AllowlistService,
    private readonly tokens: AuthTokenService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>("AUTH_BASE_URL") ?? "http://localhost:3000";
  }

  @Public()
  @Get("login/:provider")
  @ApiExcludeEndpoint() // a redirect, not a JSON API response — not meaningful in the OpenAPI doc
  async login(@Param("provider") providerName: string, @Res() res: Response): Promise<void> {
    const client = await loadOpenIdClient();
    const oidcConfig = await this.providers.getOidcConfig(providerName);

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const authUrl = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: this.callbackUrl(providerName),
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });

    const txn: OidcTransaction = { provider: providerName, state, nonce, codeVerifier };
    res.cookie(OIDC_TXN_COOKIE, JSON.stringify(txn), {
      httpOnly: true,
      sameSite: "lax",
      secure: res.req.secure,
      maxAge: OIDC_TXN_COOKIE_TTL_MS,
    });
    res.redirect(authUrl.href);
  }

  @Public()
  @Get("callback/:provider")
  @ApiExcludeEndpoint()
  async callback(
    @Param("provider") providerName: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const client = await loadOpenIdClient();
    const txn = this.readTransaction(req, providerName);
    res.clearCookie(OIDC_TXN_COOKIE);

    const oidcConfig = await this.providers.getOidcConfig(providerName);
    const currentUrl = new URL(req.originalUrl, this.baseUrl);

    const tokenResponse = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
      pkceCodeVerifier: txn.codeVerifier,
      expectedState: txn.state,
      expectedNonce: txn.nonce,
    });

    const claims = tokenResponse.claims();
    const email = claims?.email as string | undefined;
    if (!email || claims?.email_verified !== true) {
      throw new ForbiddenException("The identity provider did not return a verified email address");
    }
    if (!this.allowlist.isAllowed(email)) {
      throw new ForbiddenException(`${email} is not on the allowlist`);
    }

    const { accessToken, refreshToken } = this.tokens.issueTokenPair(email);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      maxAge: ACCESS_TOKEN_COOKIE_TTL_MS,
    });
    res.json({ accessToken, refreshToken, tokenType: "Bearer" });
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOkResponse({ description: "The currently authenticated user" })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOkResponse({ description: "A fresh access token" })
  refresh(@Body() body: RefreshDto): { accessToken: string } {
    const email = this.tokens.verifyRefreshToken(body.refreshToken);
    if (!this.allowlist.isAllowed(email)) {
      throw new ForbiddenException(`${email} is no longer on the allowlist`);
    }
    return { accessToken: this.tokens.issueAccessToken(email) };
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE);
  }

  private callbackUrl(providerName: string): string {
    return new URL(`/auth/callback/${providerName}`, this.baseUrl).href;
  }

  private readTransaction(req: Request, expectedProvider: string): OidcTransaction {
    const raw = req.cookies?.[OIDC_TXN_COOKIE];
    if (!raw) {
      throw new BadRequestException("Missing or expired OIDC transaction — start over at /auth/login");
    }

    let txn: OidcTransaction;
    try {
      txn = JSON.parse(raw);
    } catch {
      throw new BadRequestException("Malformed OIDC transaction cookie");
    }

    if (txn.provider !== expectedProvider) {
      throw new BadRequestException("OIDC transaction provider mismatch");
    }
    return txn;
  }
}
