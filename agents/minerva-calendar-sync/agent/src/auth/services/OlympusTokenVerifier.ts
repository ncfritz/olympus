import { Inject, Injectable } from "@nestjs/common";
import * as jose from "jose";
import { authConfig, type AuthConfigType } from "../../config/configuration";

/** Who the API issues its access tokens to (ADR 0018). */
const AUDIENCE = "olympus-api";

/** What the agent reads from an Olympus access token. */
export interface OlympusClaims {
  /** The Olympus user. */
  userId: string;
  roles: string[];
}

export type VerifiedToken = { claims: OlympusClaims } | { reason: string };

/**
 * Checks Olympus access tokens with the keys the API publishes at
 * `/.well-known/jwks.json` (ADR 0029), without asking the API about each
 * one: the keys are fetched once and again when a token names one not seen
 * yet, which is how a rotation reaches the agent. The algorithm is pinned,
 * as the API pins it.
 */
@Injectable()
export class OlympusTokenVerifier {
  private readonly keys: jose.JWTVerifyGetKey;

  constructor(@Inject(authConfig.KEY) auth: AuthConfigType) {
    this.keys = jose.createRemoteJWKSet(
      new URL(`${auth.olympus.apiUrl}/.well-known/jwks.json`),
      { timeoutDuration: 10_000 },
    );
  }

  async verify(token: string): Promise<VerifiedToken> {
    try {
      const { payload } = await jose.jwtVerify(token, this.keys, {
        algorithms: ["ES256"],
        audience: AUDIENCE,
      });
      const roles = payload.roles;
      if (
        typeof payload.sub !== "string" ||
        !Array.isArray(roles) ||
        !roles.every((role): role is string => typeof role === "string")
      ) {
        return { reason: "claims are not the shape Olympus issues" };
      }
      return { claims: { userId: payload.sub, roles } };
    } catch (error: unknown) {
      return {
        reason:
          error instanceof jose.errors.JOSEError
            ? error.code
            : "verification failed",
      };
    }
  }
}
