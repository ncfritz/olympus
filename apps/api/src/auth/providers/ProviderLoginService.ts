import { loadOpenIdClient, publishedUrl } from "@ncfritz/olympus-nest";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import type { ProviderIdentity } from "../users/UserDirectoryService";
import { OidcProviderRegistry } from "./OidcProviderRegistry";

/** What we need back from the provider to know who signed in. */
export type ProviderResult =
  { identity: ProviderIdentity } | { reason: string };

/** What the provider leg needs us to remember while the user is away. */
export type ProviderLeg = {
  verifier: string;
  nonce: string;
  state: string;
  url: string;
};

const SCOPE = "openid email profile";

/**
 * The provider half of a sign-in: sending someone to Google and working out
 * who came back.
 *
 * The API is the provider's OAuth client, and the redirect URI it registers
 * is its own — `<AUTH_PUBLIC_BASE_URL>/v1/auth/callback/<provider>`. One
 * canonical base rather than whichever origin the person arrived on: a
 * redirect URI is registered with the provider as an exact string, so two
 * origins would be two registrations and two things to keep in step. The
 * client's own redirect URI is separate and is validated on its own.
 */
@Injectable()
export class ProviderLoginService {
  private readonly logger = new Logger(ProviderLoginService.name);

  constructor(
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
    private readonly providers: OidcProviderRegistry,
  ) {}

  /** Where the provider sends the browser back to. Ours, not the client's. */
  callbackUrl(provider: string): string {
    const base = this.auth.users.publicBaseUrl;
    if (base === undefined) {
      throw new Error("AUTH_PUBLIC_BASE_URL is not configured");
    }
    return publishedUrl(base, `/v1/auth/callback/${provider}`).href;
  }

  /**
   * Begins the provider leg. The verifier, nonce and state are ours — a
   * separate PKCE exchange from the one our own client is doing, because
   * we are a client here and an authorization server there.
   */
  async begin(provider: string): Promise<ProviderLeg> {
    const client = await loadOpenIdClient();
    const config = await this.providers.discover(provider);

    const verifier = client.randomPKCECodeVerifier();
    const challenge = await client.calculatePKCECodeChallenge(verifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: this.callbackUrl(provider),
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });

    return { verifier, nonce, state, url: url.href };
  }

  /**
   * Finishes it: exchanges the code and returns the identity.
   *
   * `currentUrl` has to be the same URL the provider was given as
   * `redirect_uri`, because the token exchange sends it again and the two
   * are compared — which is what `publishedUrl` is for, since a base URL
   * with a path of its own would otherwise lose it.
   */
  async complete(
    provider: string,
    callbackPathAndQuery: string,
    leg: { verifier: string; nonce: string; state: string },
  ): Promise<ProviderResult> {
    const client = await loadOpenIdClient();
    const config = await this.providers.discover(provider);
    const base = this.auth.users.publicBaseUrl;
    if (base === undefined) {
      return { reason: "AUTH_PUBLIC_BASE_URL is not configured" };
    }

    let claims: Record<string, unknown> | undefined;
    try {
      const tokens = await client.authorizationCodeGrant(
        config,
        publishedUrl(base, callbackPathAndQuery),
        {
          pkceCodeVerifier: leg.verifier,
          expectedState: leg.state,
          expectedNonce: leg.nonce,
        },
      );
      claims = tokens.claims() as Record<string, unknown> | undefined;
    } catch (error: unknown) {
      // The provider's own message may name the client secret or the code;
      // it goes to the log and never to the browser.
      this.logger.warn(
        `${provider} code exchange failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { reason: "the provider did not accept the code" };
    }

    const subject = claims?.sub;
    const email = claims?.email;
    if (typeof subject !== "string" || subject === "") {
      return { reason: "the provider returned no subject" };
    }
    if (typeof email !== "string" || email === "") {
      return { reason: "the provider returned no email address" };
    }
    return {
      identity: {
        provider,
        subject,
        email,
        // Strictly true, never truthy: some providers send the string
        // "false", and `email_verified` is what the whole link rests on.
        emailVerified: claims?.email_verified === true,
      },
    };
  }
}
