import { Injectable } from "@nestjs/common";
import { EphemeralStore, randomToken } from "./EphemeralStore";
import { verifierMatches } from "./pkce";

/** Sixty seconds (ADR 0018): long enough to redeem, short enough to lose. */
export const CODE_TTL_SECONDS = 60;

/**
 * Ten minutes for the provider round trip — someone may have to find a
 * password, approve a prompt, or fetch a phone.
 */
export const PENDING_TTL_SECONDS = 600;

/** What we remember while the user is away at the provider. */
export type PendingAuthorization = {
  clientId: string;
  /** Where the client is to be sent back to, checked before we redirect. */
  redirectUri: string;
  /** The client's own `state`, returned to it untouched. */
  clientState: string;
  /** The client's PKCE challenge, carried to the code. */
  codeChallenge: string;
  provider: string;
  /** Our PKCE verifier for the provider leg, when the provider supports it. */
  providerVerifier: string;
  /** Our nonce for the provider's id token. */
  providerNonce: string;
};

/** What a redeemed authorization code yields. */
export type AuthorizationCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  userId: string;
  /** When the provider sign-in completed: the token's `auth_time`. */
  authTime: number;
};

export type Redeemed = { code: AuthorizationCode } | { reason: string };

/**
 * The two short-lived things a sign-in needs: what we are waiting on from
 * the provider, and the code we hand the client afterwards.
 *
 * Both are single-use and neither is stored: see `EphemeralStore` for what
 * that costs.
 */
@Injectable()
export class AuthorizationCodeService {
  private readonly pending = new EphemeralStore<PendingAuthorization>(
    PENDING_TTL_SECONDS,
  );
  private readonly codes = new EphemeralStore<AuthorizationCode>(
    CODE_TTL_SECONDS,
  );

  /**
   * Remembers a sign-in against the state the provider will return.
   *
   * The state is not ours to invent: openid-client generates it for the
   * provider leg and checks it on the way back, so the store is keyed by
   * that same value rather than by a second one we would then have to carry
   * alongside it.
   */
  rememberAuthorization(state: string, pending: PendingAuthorization): void {
    this.pending.put(state, pending);
  }

  /** The authorization we were waiting on, once. */
  takeAuthorization(state: string): PendingAuthorization | undefined {
    return this.pending.take(state);
  }

  /** Issues the code the client redeems at /v1/auth/token. */
  issueCode(code: AuthorizationCode): string {
    const value = randomToken();
    this.codes.put(value, code);
    return value;
  }

  /**
   * Redeems a code for the sign-in behind it.
   *
   * Every failure returns the same shape and the caller returns the same
   * error to the client: which of these went wrong is something an attacker
   * would like to know, and the reason here is for the log.
   */
  redeem(
    value: string,
    clientId: string,
    redirectUri: string,
    verifier: string,
  ): Redeemed {
    const code = this.codes.take(value);
    if (code === undefined) return { reason: "unknown or expired code" };
    if (code.clientId !== clientId) {
      return { reason: `code was issued to "${code.clientId}"` };
    }
    // The redirect URI is repeated at the token request precisely so it can
    // be compared with the one the code was issued for (RFC 6749 §4.1.3).
    if (code.redirectUri !== redirectUri) {
      return { reason: "redirect_uri does not match the code's" };
    }
    if (!verifierMatches(verifier, code.codeChallenge)) {
      return { reason: "code_verifier does not match the challenge" };
    }
    return { code };
  }

  /** For metrics: how many sign-ins are in flight. */
  counts(): { pending: number; codes: number } {
    return { pending: this.pending.size(), codes: this.codes.size() };
  }
}
