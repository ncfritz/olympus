import * as jose from "jose";
import type { SigningKeys } from "./signingKeys";

/** Who the API issues access tokens to itself as. */
export const AUDIENCE = "olympus-api";

/** Ten minutes (ADR 0018): a role change takes effect within one. */
export const ACCESS_TOKEN_SECONDS = 600;

export type AccessTokenClaims = {
  /** The user. */
  sub: string;
  /** Which client asked for it. */
  clientId: string;
  /**
   * The session this token was issued from, `sid` on the wire (OIDC's own
   * name for it). Without it an authenticated request cannot tell which of
   * a user's sessions it belongs to, so nothing can say "this device" or
   * "you have just signed yourself out".
   */
  sessionId: string;
  roles: string[];
  /**
   * When the session's provider sign-in completed, in seconds. Refresh
   * carries it unchanged, so an operation can require a recent sign-in.
   */
  authTime: number;
};

/**
 * Signs an access token with the newest key, naming it by `kid` so a token
 * outlives a rotation.
 */
export const issueAccessToken = async (
  keys: SigningKeys,
  claims: AccessTokenClaims,
  now: number = Math.floor(Date.now() / 1000),
): Promise<string> =>
  new jose.SignJWT({
    client_id: claims.clientId,
    sid: claims.sessionId,
    roles: claims.roles,
    auth_time: claims.authTime,
  })
    .setProtectedHeader({ alg: "ES256", kid: keys.signer.kid })
    .setSubject(claims.sub)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_SECONDS)
    .sign(keys.signer.privateKey);

export type VerifiedAccessToken =
  { claims: AccessTokenClaims } | { reason: string };

/**
 * Checks a token against the keys in memory — no database, which is what
 * makes a request cheap to authenticate (ADR 0018). The algorithm is pinned:
 * without that, a token naming `none`, or an RSA key where an EC one is
 * expected, is a way in.
 */
export const verifyAccessToken = async (
  keys: SigningKeys,
  token: string,
): Promise<VerifiedAccessToken> => {
  let kid: string | undefined;
  try {
    kid = jose.decodeProtectedHeader(token).kid;
  } catch {
    return { reason: "malformed token" };
  }
  if (!kid) return { reason: "no kid" };

  const key = keys.byKid.get(kid);
  if (!key) return { reason: `unknown kid "${kid}"` };

  try {
    const { payload } = await jose.jwtVerify(token, key.publicKey, {
      algorithms: ["ES256"],
      audience: AUDIENCE,
    });
    const clientId = payload.client_id;
    const sessionId = payload.sid;
    const roles = payload.roles;
    const authTime = payload.auth_time;
    if (
      typeof payload.sub !== "string" ||
      typeof clientId !== "string" ||
      typeof sessionId !== "string" ||
      typeof authTime !== "number" ||
      !Array.isArray(roles) ||
      !roles.every((role): role is string => typeof role === "string")
    ) {
      return { reason: "claims are not the shape we issue" };
    }
    return {
      claims: { sub: payload.sub, clientId, sessionId, roles, authTime },
    };
  } catch (error: unknown) {
    const code =
      error instanceof jose.errors.JOSEError
        ? error.code
        : "verification failed";
    return { reason: code };
  }
};
