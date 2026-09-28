import { describe, expect, it, vi } from "vitest";
import {
  attemptRefresh,
  authorizeUrl,
  exchangeCode,
  type FormAnswer,
  oauthError,
  refreshTokens,
} from "../../src/oauth";

const answering = (answer: Partial<FormAnswer>) => {
  const post = vi.fn(async (): Promise<FormAnswer> => ({
    status: 200,
    body: {},
    headers: {},
    ...answer,
  }));
  return post;
};

const TOKENS = {
  access_token: "an-access-token",
  token_type: "Bearer",
  expires_in: 600,
  refresh_token: "a-refresh-token",
};

describe("authorizeUrl", () => {
  const built = authorizeUrl("http://localhost:3001/v1/", {
    clientId: "olympus-auth-tester",
    redirectUri: "http://127.0.0.1:52345/callback",
    challenge: "a".repeat(43),
    state: "some-state",
    provider: "google",
  });

  /**
   * Spelled out because this string is built by hand: React Native's `URL` is
   * partial, so the package cannot use it, and an encoding fault here reads as
   * the API refusing a redirect_uri it never received intact.
   */
  it("percent-encodes what has to be encoded, and nothing else", () => {
    expect(built).toBe(
      "http://localhost:3001/v1/auth/authorize" +
        "?client_id=olympus-auth-tester" +
        "&redirect_uri=http%3A%2F%2F127.0.0.1%3A52345%2Fcallback" +
        "&response_type=code" +
        `&code_challenge=${"a".repeat(43)}` +
        "&code_challenge_method=S256" +
        "&state=some-state" +
        "&provider=google",
    );
  });

  const url = new URL(
    authorizeUrl("http://localhost:3001/v1/", {
      clientId: "olympus-auth-tester",
      redirectUri: "http://127.0.0.1:52345/callback",
      challenge: "a".repeat(43),
      state: "some-state",
      provider: "google",
    }),
  );

  it("asks for a code with an S256 challenge", () => {
    expect(url.pathname).toBe("/v1/auth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "olympus-auth-tester",
      redirect_uri: "http://127.0.0.1:52345/callback",
      response_type: "code",
      code_challenge: "a".repeat(43),
      code_challenge_method: "S256",
      state: "some-state",
      provider: "google",
    });
  });
});

describe("exchangeCode", () => {
  it("sends the grant RFC 6749 4.1.3 describes", async () => {
    const post = answering({ body: TOKENS });
    const issued = await exchangeCode(post, {
      code: "a-code",
      redirectUri: "http://127.0.0.1:52345/callback",
      clientId: "olympus-auth-tester",
      verifier: "a-verifier",
      deviceName: "a laptop",
    });

    expect(post).toHaveBeenCalledWith("/auth/token", {
      grant_type: "authorization_code",
      code: "a-code",
      redirect_uri: "http://127.0.0.1:52345/callback",
      client_id: "olympus-auth-tester",
      code_verifier: "a-verifier",
      device_name: "a laptop",
    });
    expect(issued).toEqual({
      accessToken: "an-access-token",
      expiresIn: 600,
      refreshToken: "a-refresh-token",
    });
  });

  it("reports the OAuth error rather than the status", async () => {
    await expect(
      exchangeCode(
        answering({
          status: 400,
          body: {
            error: "invalid_grant",
            error_description: "the code is not valid",
          },
        }),
        {
          code: "a-code",
          redirectUri: "http://127.0.0.1:1/callback",
          clientId: "olympus-auth-tester",
          verifier: "a-verifier",
          deviceName: "a laptop",
        },
      ),
    ).rejects.toThrow("the API refused: invalid_grant (the code is not valid)");
  });

  it("says how long to wait when the rate limit refuses it", async () => {
    await expect(
      exchangeCode(
        answering({ status: 429, body: {}, headers: { "retry-after": "42" } }),
        {
          code: "a-code",
          redirectUri: "http://127.0.0.1:1/callback",
          clientId: "olympus-auth-tester",
          verifier: "a-verifier",
          deviceName: "a laptop",
        },
      ),
    ).rejects.toThrow("try again in 42s");
  });

  /**
   * The tester is registered to receive its refresh token in the body. A 200
   * without one means the registration has been changed to the cookie the site
   * uses, which a CLI has nowhere to keep -- worth saying, rather than failing
   * at the next refresh.
   */
  it("says so when the refresh token is missing", async () => {
    await expect(
      exchangeCode(
        answering({ body: { ...TOKENS, refresh_token: undefined } }),
        {
          code: "a-code",
          redirectUri: "http://127.0.0.1:1/callback",
          clientId: "olympus-auth-tester",
          verifier: "a-verifier",
          deviceName: "a laptop",
        },
      ),
    ).rejects.toThrow(/cookie/);
  });
});

describe("refreshTokens", () => {
  it("sends the refresh grant", async () => {
    const post = answering({ body: TOKENS });
    await refreshTokens(post, {
      clientId: "olympus-auth-tester",
      refreshToken: "a-refresh-token",
    });
    expect(post).toHaveBeenCalledWith("/auth/token", {
      grant_type: "refresh_token",
      client_id: "olympus-auth-tester",
      refresh_token: "a-refresh-token",
    });
  });

  /** The replay needs the refusal itself, so this one does not throw. */
  it("attemptRefresh hands back the refusal", async () => {
    const answer = await attemptRefresh(
      answering({ status: 400, body: { error: "invalid_grant" } }),
      { clientId: "olympus-auth-tester", refreshToken: "a-rotated-token" },
    );
    expect(answer.status).toBe(400);
    expect(oauthError(answer)).toEqual({ error: "invalid_grant" });
  });
});

describe("oauthError", () => {
  it("is nothing when the body is not an OAuth error", () => {
    expect(
      oauthError({ status: 200, body: { access_token: "x" }, headers: {} }),
    ).toBeUndefined();
    expect(
      oauthError({ status: 502, body: "<html>", headers: {} }),
    ).toBeUndefined();
  });
});
