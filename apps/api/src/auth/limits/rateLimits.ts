import { SetMetadata } from "@nestjs/common";
import type { RateLimit } from "./RateLimiter";

export const RATE_LIMIT = "olympus:rateLimit";

/**
 * How often this endpoint may be called (see {@link RateLimiter}).
 *
 * Opt-in per route rather than applied to everything: a limit on an
 * authenticated API call wants a different key and a different number, and
 * guessing one for every endpoint is how a rate limit becomes an outage.
 */
export const RateLimited = (limit: RateLimit) => SetMetadata(RATE_LIMIT, limit);

/**
 * The numbers, in one place so they can be read against each other.
 *
 * All three are far above what a person signing in produces and far below
 * what it takes to matter. The per-client figures assume a shared address —
 * an office, a phone network, a VPN — so they are generous; the ceilings are
 * sized by what they protect rather than by the per-client figure.
 */
export const AUTH_LIMITS = {
  /**
   * Beginning a sign-in. The ceiling is what bounds the pending
   * authorization store: entries live 600 seconds, so 120 a minute holds at
   * most about 1,200 of them.
   */
  beginSignIn: { perClient: 10, global: 120, windowSeconds: 60 },
  /**
   * The provider's callback. Each one that carries a live state costs a
   * token exchange with the provider, so this is as much about not
   * hammering them as about us.
   */
  completeSignIn: { perClient: 10, global: 120, windowSeconds: 60 },
  /**
   * Tokens. Higher, because refreshing is routine: an access token lives
   * ten minutes, and one person may have several clients and several tabs
   * refreshing independently.
   */
  createToken: { perClient: 30, global: 300, windowSeconds: 60 },
} as const satisfies Record<string, RateLimit>;
