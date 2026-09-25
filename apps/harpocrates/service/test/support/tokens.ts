import * as fs from "fs";
import * as jose from "jose";
import * as path from "path";

const KEY = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../fixtures/signing-key.json"), "utf8"),
) as jose.JWK;

/**
 * An access token as the API issues them (ADR 0018), signed with the test
 * key whose public half is test/fixtures/jwks.json.
 */
export const accessToken = async (options: {
  roles: string[];
  sub?: string;
  /** Seconds since the sign-in; 0 by default. */
  signedInAgo?: number;
  audience?: string;
}): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return new jose.SignJWT({
    client_id: "harpocrates-test",
    sid: "session-1",
    roles: options.roles,
    auth_time: now - (options.signedInAgo ?? 0),
  })
    .setProtectedHeader({ alg: "ES256", kid: KEY.kid })
    .setSubject(options.sub ?? "user-1")
    .setAudience(options.audience ?? "olympus-api")
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(await jose.importJWK(KEY, "ES256"));
};

export const bearer = async (roles: string[], signedInAgo = 0) =>
  `Bearer ${await accessToken({ roles, signedInAgo })}`;
