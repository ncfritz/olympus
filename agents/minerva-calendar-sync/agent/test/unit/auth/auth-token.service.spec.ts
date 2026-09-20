import { JwtService } from "@nestjs/jwt";
import { AuthTokenService } from "../../../src/auth/auth-token.service";
import { beforeEach, describe, expect, it } from "vitest";

describe("AuthTokenService", () => {
  let tokens: AuthTokenService;

  beforeEach(() => {
    tokens = new AuthTokenService(new JwtService({ secret: "test-secret" }));
  });

  it("round-trips an access token", () => {
    const accessToken = tokens.issueAccessToken("me@example.com");
    expect(tokens.verifyAccessToken(accessToken)).toBe("me@example.com");
  });

  it("round-trips a token pair", () => {
    const { accessToken, refreshToken } =
      tokens.issueTokenPair("me@example.com");
    expect(tokens.verifyAccessToken(accessToken)).toBe("me@example.com");
    expect(tokens.verifyRefreshToken(refreshToken)).toBe("me@example.com");
  });

  it("rejects a refresh token presented as an access token", () => {
    const { refreshToken } = tokens.issueTokenPair("me@example.com");
    expect(() => tokens.verifyAccessToken(refreshToken)).toThrow(
      /access token/,
    );
  });

  it("rejects an access token presented as a refresh token", () => {
    const accessToken = tokens.issueAccessToken("me@example.com");
    expect(() => tokens.verifyRefreshToken(accessToken)).toThrow(
      /refresh token/,
    );
  });

  it("rejects a garbage token", () => {
    expect(() => tokens.verifyAccessToken("not-a-jwt")).toThrow(
      /Invalid or expired/,
    );
  });

  it("rejects a token signed with a different secret", () => {
    const other = new AuthTokenService(
      new JwtService({ secret: "different-secret" }),
    );
    const accessToken = other.issueAccessToken("me@example.com");
    expect(() => tokens.verifyAccessToken(accessToken)).toThrow(
      /Invalid or expired/,
    );
  });

  it("rejects an expired token", () => {
    // AuthTokenService.sign always passes its own expiresIn per call, so an
    // expired fixture has to be minted directly against the raw JwtService.
    const raw = new JwtService({ secret: "test-secret" });
    const expiredToken = raw.sign(
      { email: "me@example.com", type: "access" },
      { expiresIn: "-1s" },
    );
    expect(() => tokens.verifyAccessToken(expiredToken)).toThrow(
      /Invalid or expired/,
    );
  });
});
