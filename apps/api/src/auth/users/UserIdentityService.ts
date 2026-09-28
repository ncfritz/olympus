import { Injectable } from "@nestjs/common";
import type { RequestWithPrincipal, UserPrincipal } from "../principal";
import { verifyAccessToken } from "../tokens/accessTokens";
import { SigningKeyService } from "../tokens/SigningKeyService";

export type UserIdentity = { principal: UserPrincipal } | { reason: string };

const BEARER = /^Bearer (.+)$/;

/**
 * The principal of a request on the users listener: its access token
 * (ADR 0018).
 *
 * No database. The signature is checked against the keys in memory and the
 * roles are in the token, which is what makes an authenticated request cost
 * nothing — and is why a role change takes until the next refresh to matter.
 */
@Injectable()
export class UserIdentityService {
  constructor(private readonly keys: SigningKeyService) {}

  async identify(request: RequestWithPrincipal): Promise<UserIdentity> {
    const header = request.headers.authorization;
    if (header === undefined) return { reason: "no credentials" };
    const match = BEARER.exec(header);
    if (match === null) return { reason: "no credentials" };
    return this.identifyToken(match[1]!);
  }

  /**
   * The same identity from a bare token, for a caller that does not have an
   * `Authorization` header to read: the notifications gateway, where the token
   * arrives in the Socket.IO handshake rather than in a header.
   *
   * Shared so that the socket and the HTTP request cannot come to different
   * conclusions about the same token.
   */
  async identifyToken(token: string): Promise<UserIdentity> {
    if (token === "") return { reason: "no credentials" };

    const keys = this.keys.available();
    if (keys === undefined) {
      // Nothing can be verified, so nothing is trusted — rather than
      // everything being accepted.
      return { reason: "tokens are not configured" };
    }

    const verified = await verifyAccessToken(keys, token);
    if ("reason" in verified)
      return { reason: `invalid token: ${verified.reason}` };

    return {
      principal: {
        kind: "user",
        userId: verified.claims.sub,
        roles: verified.claims.roles,
        client: verified.claims.clientId,
        sessionId: verified.claims.sessionId,
      },
    };
  }
}
