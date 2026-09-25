import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_SECONDS,
  AUDIENCE,
  issueAccessToken,
  verifyAccessToken,
} from "../../../../src/auth/tokens/accessTokens";
import {
  loadSigningKeys,
  type SigningKeys,
} from "../../../../src/auth/tokens/signingKeys";

/** A real ES256 key, as a PKCS#8 PEM — the same thing XCA would give us. */
const pem = async () => {
  const { privateKey } = await jose.generateKeyPair("ES256", {
    extractable: true,
  });
  return jose.exportPKCS8(privateKey);
};

const directory = async (names: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), "keys-"));
  for (const name of names) writeFileSync(join(dir, name), await pem());
  return dir;
};

const claims = {
  sub: "5f1a0c6e-0000-4000-8000-000000000001",
  clientId: "olympus-site",
  sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
  roles: ["user", "admin"],
  authTime: 1_790_000_000,
};

describe("loadSigningKeys", () => {
  it("derives the kid from the key, not the filename", async () => {
    const dir = await directory(["2026-01-01.pem"]);
    const first = await loadSigningKeys(dir);
    // The same key, read again: the kid must not have moved.
    const again = await loadSigningKeys(dir);
    expect(again.signer.kid).toBe(first.signer.kid);
    expect(first.signer.kid).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("signs with the last filename and verifies with all of them", async () => {
    const dir = await directory([
      "2026-01-01.pem",
      "2026-06-01.pem",
      "2026-09-01.pem",
    ]);
    const keys = await loadSigningKeys(dir);
    expect(keys.byKid.size).toBe(3);
    expect(keys.signer.source).toBe("2026-09-01.pem");
    expect(keys.jwks.keys).toHaveLength(3);
  });

  it("publishes public keys only", async () => {
    const keys = await loadSigningKeys(await directory(["a.pem"]));
    for (const jwk of keys.jwks.keys) {
      expect(jwk).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256" });
      // The private scalar must never reach the JWKS document.
      expect(jwk).not.toHaveProperty("d");
      expect(jwk.kid).toBeTruthy();
    }
  });

  it("ignores files that are not .pem", async () => {
    const dir = await directory(["real.pem"]);
    writeFileSync(join(dir, "README"), "not a key");
    writeFileSync(join(dir, "old.pem.bak"), "not a key either");
    const keys = await loadSigningKeys(dir);
    expect(keys.byKid.size).toBe(1);
  });

  it("refuses a directory with no keys", async () => {
    const dir = mkdtempSync(join(tmpdir(), "keys-"));
    await expect(loadSigningKeys(dir)).rejects.toThrow(/no \.pem files/);
  });

  it("refuses the same key twice, whatever the files are called", async () => {
    const dir = mkdtempSync(join(tmpdir(), "keys-"));
    const one = await pem();
    writeFileSync(join(dir, "a.pem"), one);
    writeFileSync(join(dir, "b.pem"), one);
    await expect(loadSigningKeys(dir)).rejects.toThrow(/same key twice/);
  });
});

describe("access tokens", () => {
  let keys: SigningKeys;
  let rotated: SigningKeys;

  beforeAll(async () => {
    keys = await loadSigningKeys(await directory(["2026-01-01.pem"]));
    rotated = await loadSigningKeys(await directory(["2026-02-01.pem"]));
  });

  it("round-trips the claims it was given", async () => {
    const token = await issueAccessToken(keys, claims);
    await expect(verifyAccessToken(keys, token)).resolves.toEqual({ claims });
  });

  it("names the signing key in the header", async () => {
    const token = await issueAccessToken(keys, claims);
    expect(jose.decodeProtectedHeader(token)).toEqual({
      alg: "ES256",
      kid: keys.signer.kid,
    });
  });

  it("expires in ten minutes", async () => {
    const now = 1_790_100_000;
    const token = await issueAccessToken(keys, claims, now);
    const payload = jose.decodeJwt(token);
    expect(payload.iat).toBe(now);
    expect(payload.exp).toBe(now + ACCESS_TOKEN_SECONDS);
    expect(payload.aud).toBe(AUDIENCE);
  });

  it("refuses a token signed by a key it does not have", async () => {
    const token = await issueAccessToken(rotated, claims);
    await expect(verifyAccessToken(keys, token)).resolves.toEqual({
      reason: `unknown kid "${rotated.signer.kid}"`,
    });
  });

  it("verifies a token from a retired key that is still loaded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "keys-"));
    writeFileSync(join(dir, "2026-01-01.pem"), await pem());
    const before = await loadSigningKeys(dir);
    const token = await issueAccessToken(before, claims);

    writeFileSync(join(dir, "2026-02-01.pem"), await pem());
    const after = await loadSigningKeys(dir);
    expect(after.signer.source).toBe("2026-02-01.pem");
    // Issued by the old key, which still verifies: that is the point of kid.
    await expect(verifyAccessToken(after, token)).resolves.toEqual({ claims });
  });

  it("refuses an expired token", async () => {
    const token = await issueAccessToken(
      keys,
      claims,
      Math.floor(Date.now() / 1000) - ACCESS_TOKEN_SECONDS - 60,
    );
    await expect(verifyAccessToken(keys, token)).resolves.toEqual({
      reason: "ERR_JWT_EXPIRED",
    });
  });

  it("refuses a token for another audience", async () => {
    const token = await new jose.SignJWT({
      client_id: claims.clientId,
      sid: claims.sessionId,
      roles: claims.roles,
      auth_time: claims.authTime,
    })
      .setProtectedHeader({ alg: "ES256", kid: keys.signer.kid })
      .setSubject(claims.sub)
      .setAudience("somebody-else")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(keys.signer.privateKey);
    await expect(verifyAccessToken(keys, token)).resolves.toEqual({
      reason: "ERR_JWT_CLAIM_VALIDATION_FAILED",
    });
  });

  it("carries the session as `sid`, OIDC's name for it", async () => {
    const token = await issueAccessToken(keys, claims);
    // On the wire, not just in our own type: a client reading the token
    // looks for sid.
    expect(jose.decodeJwt(token).sid).toBe(claims.sessionId);
  });

  it("refuses a token with no session in it", async () => {
    // A token issued before sid existed, or one somebody built by hand.
    // There is no sensible default for "which session", so it is not valid.
    const token = await new jose.SignJWT({
      client_id: claims.clientId,
      roles: claims.roles,
      auth_time: claims.authTime,
    })
      .setProtectedHeader({ alg: "ES256", kid: keys.signer.kid })
      .setSubject(claims.sub)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(keys.signer.privateKey);
    await expect(verifyAccessToken(keys, token)).resolves.toEqual({
      reason: "claims are not the shape we issue",
    });
  });

  it("refuses a token whose claims are not the shape we issue", async () => {
    const token = await new jose.SignJWT({ client_id: 42 })
      .setProtectedHeader({ alg: "ES256", kid: keys.signer.kid })
      .setSubject(claims.sub)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(keys.signer.privateKey);
    await expect(verifyAccessToken(keys, token)).resolves.toEqual({
      reason: "claims are not the shape we issue",
    });
  });

  it("refuses a header without a kid", async () => {
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "ES256" })
      .setSubject(claims.sub)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(keys.signer.privateKey);
    await expect(verifyAccessToken(keys, token)).resolves.toEqual({
      reason: "no kid",
    });
  });

  it("refuses something that is not a token", async () => {
    await expect(verifyAccessToken(keys, "not.a.token")).resolves.toEqual({
      reason: "malformed token",
    });
  });
});
