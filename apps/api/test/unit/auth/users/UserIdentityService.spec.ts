import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import type { RequestWithPrincipal } from "../../../../src/auth/principal";
import { issueAccessToken } from "../../../../src/auth/tokens/accessTokens";
import {
  loadSigningKeys,
  type SigningKeys,
} from "../../../../src/auth/tokens/signingKeys";
import type { SigningKeyService } from "../../../../src/auth/tokens/SigningKeyService";
import { UserIdentityService } from "../../../../src/auth/users/UserIdentityService";

const keysFrom = async () => {
  const dir = mkdtempSync(join(tmpdir(), "keys-"));
  const { privateKey } = await jose.generateKeyPair("ES256", {
    extractable: true,
  });
  writeFileSync(join(dir, "a.pem"), await jose.exportPKCS8(privateKey));
  return loadSigningKeys(dir);
};

const service = (keys?: SigningKeys) =>
  new UserIdentityService({
    available: () => keys,
  } as unknown as SigningKeyService);

const request = (authorization?: string) =>
  ({
    headers: authorization === undefined ? {} : { authorization },
  }) as unknown as RequestWithPrincipal;

const CLAIMS = {
  sub: "5f1a0c6e-0000-4000-8000-000000000001",
  clientId: "olympus-site",
  roles: ["user", "admin"],
  authTime: 1_790_000_000,
};

describe("UserIdentityService", () => {
  let keys: SigningKeys;
  let other: SigningKeys;

  beforeAll(async () => {
    keys = await keysFrom();
    other = await keysFrom();
  });

  it("reads the user, roles and client from a valid token", async () => {
    const token = await issueAccessToken(keys, CLAIMS);
    await expect(
      service(keys).identify(request(`Bearer ${token}`)),
    ).resolves.toEqual({
      principal: {
        kind: "user",
        userId: CLAIMS.sub,
        roles: CLAIMS.roles,
        client: "olympus-site",
      },
    });
  });

  it.each([
    ["no header at all", undefined],
    ["a header that is not Bearer", "Basic abc"],
    ["Bearer with nothing after it", "Bearer "],
  ])("reports %s as no credentials", async (_what, header) => {
    await expect(service(keys).identify(request(header))).resolves.toEqual({
      reason: "no credentials",
    });
  });

  it("refuses a token signed by a key it does not have", async () => {
    const token = await issueAccessToken(other, CLAIMS);
    const result = await service(keys).identify(request(`Bearer ${token}`));
    expect(result).toMatchObject({
      reason: expect.stringContaining("invalid token: unknown kid"),
    });
  });

  it("refuses an expired token", async () => {
    const token = await issueAccessToken(
      keys,
      CLAIMS,
      Math.floor(Date.now() / 1000) - 3600,
    );
    await expect(
      service(keys).identify(request(`Bearer ${token}`)),
    ).resolves.toEqual({ reason: "invalid token: ERR_JWT_EXPIRED" });
  });

  it("refuses everything when there are no keys, rather than accepting it", async () => {
    // Nothing can be verified, so nothing is trusted.
    const token = await issueAccessToken(keys, CLAIMS);
    await expect(
      service(undefined).identify(request(`Bearer ${token}`)),
    ).resolves.toEqual({ reason: "tokens are not configured" });
  });

  it("refuses something that is not a token", async () => {
    await expect(
      service(keys).identify(request("Bearer not.a.token")),
    ).resolves.toEqual({ reason: "invalid token: malformed token" });
  });
});
