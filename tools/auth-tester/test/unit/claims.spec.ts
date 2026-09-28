import { describe, expect, it } from "vitest";
import { decodeToken, describeToken } from "../../src/claims";

const part = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const token = (
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
): string => `${part(header)}.${part(claims)}.not-a-signature`;

describe("decodeToken", () => {
  it("reads the header and the claims", () => {
    const decoded = decodeToken(
      token(
        { alg: "ES256", kid: "a-thumbprint" },
        { sub: "user-1", sid: "session-1", roles: ["admin"] },
      ),
    );
    expect(decoded.header.kid).toBe("a-thumbprint");
    expect(decoded.claims.roles).toEqual(["admin"]);
  });

  it("says so when it is handed something that is not a JWT", () => {
    expect(() => decodeToken("not-a-token")).toThrow(/three parts/);
    expect(() => decodeToken("a.b.c")).toThrow(/not JSON/);
    expect(() => decodeToken(`${part([1])}.${part([2])}.c`)).toThrow(
      /not an object/,
    );
  });
});

describe("describeToken", () => {
  /**
   * `client_id` and `auth_time` are two characters longer than the rest, and
   * a column they overflow is worse than no column at all.
   */
  it("starts every value in the same column", () => {
    const lines = describeToken(
      decodeToken(
        token(
          { alg: "ES256", kid: "k" },
          {
            sub: "user-1",
            sid: "session-1",
            client_id: "olympus-auth-tester",
            roles: ["admin"],
            auth_time: 1_790_000_000,
            exp: 1_790_000_600,
          },
        ),
      ),
    );
    const columns = new Set(lines.map((l) => /^\s+\S+\s+/.exec(l)![0].length));
    expect(columns.size).toBe(1);
  });

  it("reads the times as times and keeps every other claim", () => {
    const lines = describeToken(
      decodeToken(
        token(
          { alg: "ES256", kid: "k" },
          { sub: "user-1", exp: 1_790_000_000, surprising: "kept" },
        ),
      ),
    ).join("\n");
    expect(lines).toContain("2026-");
    expect(lines).toContain("surprising kept");
  });
});
