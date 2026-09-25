import { describe, expect, it } from "vitest";
import { CLIENTS, resolveClients } from "../../../../src/auth/clients/clients";

const ORIGINS = [
  "https://olympus.internal.ncfritz.net",
  "https://olympus.ncfritz.net",
];

const clients = resolveClients(ORIGINS);
const site = clients.get("olympus-site")!;
const ios = clients.get("olympus-ios")!;
const tester = clients.get("olympus-auth-tester")!;

describe("resolveClients", () => {
  it("has the three clients, with their refresh delivery", () => {
    expect([...clients.keys()].sort()).toEqual([
      "olympus-auth-tester",
      "olympus-ios",
      "olympus-site",
    ]);
    expect(site.refreshToken).toBe("cookie");
    expect(ios.refreshToken).toBe("body");
  });

  it("tolerates a trailing slash on a configured origin", () => {
    const withSlash = resolveClients(["https://olympus.ncfritz.net/"]);
    expect(
      withSlash
        .get("olympus-site")!
        .accepts("https://olympus.ncfritz.net/auth/callback"),
    ).toBe(true);
  });
});

describe("the site's redirect URIs", () => {
  it("accepts the callback on each configured origin", () => {
    for (const origin of ORIGINS) {
      expect(site.accepts(`${origin}/auth/callback`)).toBe(true);
    }
  });

  it.each([
    ["a path it did not register", "https://olympus.ncfritz.net/auth/other"],
    ["an origin it was not given", "https://evil.example/auth/callback"],
    [
      "a lookalike host",
      "https://olympus.ncfritz.net.evil.example/auth/callback",
    ],
    [
      "http where https was registered",
      "http://olympus.ncfritz.net/auth/callback",
    ],
    ["a trailing slash", "https://olympus.ncfritz.net/auth/callback/"],
    ["an added query", "https://olympus.ncfritz.net/auth/callback?next=/x"],
  ])("refuses %s", (_what, uri) => {
    expect(site.accepts(uri)).toBe(false);
  });

  it("has no loopback redirect", () => {
    expect(site.accepts("http://127.0.0.1:1234/callback")).toBe(false);
  });
});

describe("a native client's custom scheme", () => {
  it("accepts exactly what it registered", () => {
    expect(ios.accepts("olympus://auth")).toBe(true);
  });

  it.each([
    ["another scheme", "olympus-auth-tester://auth"],
    ["another path", "olympus://something-else"],
  ])("refuses %s", (_what, uri) => {
    expect(ios.accepts(uri)).toBe(false);
  });
});

describe("the tester's loopback redirect", () => {
  // RFC 8252: a native client cannot reserve a port, so the port varies.
  it.each([
    "http://127.0.0.1:1234/callback",
    "http://127.0.0.1:49152/callback",
    "http://[::1]:8080/callback",
  ])("accepts %s", (uri) => {
    expect(tester.accepts(uri)).toBe(true);
  });

  it.each([
    [
      "localhost, which can resolve elsewhere",
      "http://localhost:1234/callback",
    ],
    ["a host that is not loopback", "http://10.0.0.1:1234/callback"],
    ["another path", "http://127.0.0.1:1234/elsewhere"],
    [
      "a query, which would smuggle a parameter",
      "http://127.0.0.1:1234/callback?x=1",
    ],
    ["a fragment", "http://127.0.0.1:1234/callback#x"],
    ["something that is not a URL", "not a url"],
  ])("refuses %s", (_what, uri) => {
    expect(tester.accepts(uri)).toBe(false);
  });

  it("still accepts its custom scheme", () => {
    expect(tester.accepts("olympus-auth-tester://auth")).toBe(true);
  });
});

describe("CLIENTS", () => {
  it("is every client the plan lists, and no others", () => {
    expect(CLIENTS.map((client) => client.id)).toEqual([
      "olympus-site",
      "olympus-ios",
      "olympus-auth-tester",
    ]);
  });

  it("gives only the browser its refresh token in a cookie", () => {
    const cookie = CLIENTS.filter((c) => c.refreshToken === "cookie");
    expect(cookie.map((c) => c.id)).toEqual(["olympus-site"]);
  });
});
