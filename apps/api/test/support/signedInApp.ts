import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ClientError } from "graphql-request";
import * as jose from "jose";
import type { Test } from "supertest";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { issueAccessToken } from "../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../src/auth/tokens/SigningKeyService";
import { createTestApp, type TestApp } from "./testApp";

export const USER = "5f1a0c6e-0000-4000-8000-000000000001";
export const OTHER_USER = "5f1a0c6e-0000-4000-8000-0000000000ff";

/** What Hasura answers when a unique key or index refuses a row. */
export const uniqueViolation = (): never => {
  throw new ClientError(
    {
      status: 200,
      errors: [
        {
          message: "Uniqueness violation",
          extensions: { code: "constraint-violation", path: "$" },
        },
      ],
    } as unknown as ConstructorParameters<typeof ClientError>[0],
    { query: "" },
  );
};

/**
 * A test app with signing keys, and requests signed as a user: `as(...)`
 * signs as USER unless `signInAs` named another user for this test.
 */
export const signedInApp = () => {
  const ctx = {} as {
    t: TestApp;
    as: (request: Test) => Test;
    signInAs: (sub: string) => Promise<void>;
  };
  let token = "";
  const tokenFor = (sub: string) =>
    issueAccessToken(ctx.t.app.get(SigningKeyService).require(), {
      sub,
      clientId: "olympus-site",
      sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
      roles: ["user"],
      authTime: 1_790_000_000,
    });
  ctx.as = (request) => request.set("authorization", `Bearer ${token}`);
  ctx.signInAs = async (sub) => {
    token = await tokenFor(sub);
  };

  beforeAll(async () => {
    const keys = mkdtempSync(join(tmpdir(), "auth-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    ctx.t = await createTestApp({ env: { AUTH_SIGNING_KEYS: keys } });
  });

  afterAll(async () => {
    await ctx.t.close();
  });

  beforeEach(async () => {
    ctx.t.reset();
    token = await tokenFor(USER);
  });

  return ctx;
};
