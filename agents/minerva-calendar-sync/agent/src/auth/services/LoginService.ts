import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { loadOpenIdClient } from "../openidClientLoader";
import { publishedUrl } from "../publishedUrl";
import { sanitizeReturnTo } from "../sanitizeReturnTo";
import { AllowlistService } from "./AllowlistService";
import { AuthTokenService, type TokenPair } from "./AuthTokenService";
import { OidcProviderRegistry } from "./OidcProviderRegistry";

/** The in-flight OIDC sign-in, kept in a short-lived cookie between login and callback. */
export interface OidcTransaction {
  provider: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  /** Where to redirect the browser after a successful login. Absent for non-browser (Bearer) callers, which get the tokens as JSON instead. */
  returnTo?: string;
}

/**
 * Sign-in to the management API through an OIDC provider (authorization
 * code with PKCE), limited to the allowlist.
 */
@Injectable()
export class LoginService {
  private readonly baseUrl: string;
  private readonly webAppUrl?: string;

  constructor(
    private readonly providers: OidcProviderRegistry,
    private readonly allowlist: AllowlistService,
    private readonly tokens: AuthTokenService,
    @Inject(authConfig.KEY) auth: AuthConfigType,
  ) {
    this.baseUrl = auth.baseUrl;
    this.webAppUrl = auth.webAppUrl;
  }

  /** The provider's authorization URL, and the transaction to keep until its callback. */
  async start(
    providerName: string,
    returnTo: string | undefined,
  ): Promise<{ authUrl: string; transaction: OidcTransaction }> {
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

    return {
      authUrl: authUrl.href,
      transaction: {
        provider: providerName,
        state,
        nonce,
        codeVerifier,
        returnTo: sanitizeReturnTo(returnTo, this.webAppUrl),
      },
    };
  }

  /**
   * Exchanges the callback's code for the user's identity and issues the
   * app's own tokens.
   * @param rawTransaction the transaction cookie set by start()
   * @param callbackPath the callback request's path and query
   */
  async complete(
    providerName: string,
    rawTransaction: string | undefined,
    callbackPath: string,
  ): Promise<TokenPair & { returnTo?: string }> {
    const client = await loadOpenIdClient();
    const txn = this.readTransaction(rawTransaction, providerName);

    const oidcConfig = await this.providers.getOidcConfig(providerName);
    // Under AUTH_BASE_URL, so this is the same URL the provider was given
    // as redirect_uri at start(): the token exchange sends it again, and
    // the two have to agree.
    const currentUrl = publishedUrl(this.baseUrl, callbackPath);

    const tokenResponse = await client.authorizationCodeGrant(
      oidcConfig,
      currentUrl,
      {
        pkceCodeVerifier: txn.codeVerifier,
        expectedState: txn.state,
        expectedNonce: txn.nonce,
      },
    );

    const claims = tokenResponse.claims();
    const email = claims?.email as string | undefined;
    if (!email || claims?.email_verified !== true) {
      throw new ForbiddenException(
        "The identity provider did not return a verified email address",
      );
    }
    if (!this.allowlist.isAllowed(email)) {
      throw new ForbiddenException(`${email} is not on the allowlist`);
    }

    return { ...this.tokens.issueTokenPair(email), returnTo: txn.returnTo };
  }

  /** A new access token for a refresh token whose user is still allowed in. */
  refresh(refreshToken: string): string {
    const email = this.tokens.verifyRefreshToken(refreshToken);
    if (!this.allowlist.isAllowed(email)) {
      throw new ForbiddenException(`${email} is no longer on the allowlist`);
    }
    return this.tokens.issueAccessToken(email);
  }

  /** Registered with each provider; nginx publishes it under the console. */
  private callbackUrl(providerName: string): string {
    return publishedUrl(this.baseUrl, `auth/callback/${providerName}`).href;
  }

  private readTransaction(
    raw: string | undefined,
    expectedProvider: string,
  ): OidcTransaction {
    if (!raw) {
      throw new BadRequestException(
        "Missing or expired OIDC transaction — start over at /auth/login",
      );
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
