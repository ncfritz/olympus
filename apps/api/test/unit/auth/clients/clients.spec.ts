import { describe, expect, it } from "vitest";
import { CLIENTS, resolveClients } from "../../../../src/auth/clients/clients";

const ORIGINS = [
  "https://olympus.internal.ncfritz.net",
  "https://olympus.ncfritz.net",
];

const CONSOLE_BASE_URLS = {
  "minerva-calendar-console": [
    "https://control.olympus.ncfritz.net/minerva/calendar/api",
    "http://localhost:4432",
  ],
  "harpocrates-ca-console": [
    "https://control.olympus.ncfritz.net/harpocrates/ca/api",
  ],
};

const clients = resolveClients({ site: ORIGINS, console: CONSOLE_BASE_URLS });
const site = clients.get("olympus-site")!;
const ios = clients.get("olympus-ios")!;
const tester = clients.get("olympus-auth-tester")!;
const minervaConsole = clients.get("minerva-calendar-console")!;

describe("resolveClients", () => {
  it("has the five clients, with their refresh delivery", () => {
    expect([...clients.keys()].sort()).toEqual([
      "harpocrates-ca-console",
      "minerva-calendar-console",
      "olympus-auth-tester",
      "olympus-ios",
      "olympus-site",
    ]);
    expect(site.refreshToken).toBe("cookie");
    expect(ios.refreshToken).toBe("body");
    expect(minervaConsole.refreshToken).toBe("body");
  });

  it("tolerates a trailing slash on a configured origin", () => {
    const withSlash = resolveClients({
      site: ["https://olympus.ncfritz.net/"],
      console: {},
    });
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

describe("the Minerva calendar console's redirect URIs", () => {
  it("accepts the agent's callback wherever the agent is published", () => {
    for (const base of CONSOLE_BASE_URLS["minerva-calendar-console"]) {
      expect(minervaConsole.accepts(`${base}/auth/callback`)).toBe(true);
    }
  });

  it.each([
    ["the site's callback", "https://olympus.ncfritz.net/auth/callback"],
    [
      "the control host's root",
      "https://control.olympus.ncfritz.net/auth/callback",
    ],
    [
      "another console's agent",
      "https://control.olympus.ncfritz.net/dionysus/asset/api/auth/callback",
    ],
    [
      "Harpocrates's console's service, though it is a console too",
      "https://control.olympus.ncfritz.net/harpocrates/ca/api/auth/callback",
    ],
    [
      "an added query",
      "https://control.olympus.ncfritz.net/minerva/calendar/api/auth/callback?x=1",
    ],
  ])("refuses %s", (_what, uri) => {
    expect(minervaConsole.accepts(uri)).toBe(false);
  });

  it("is not accepted by the site", () => {
    expect(
      site.accepts(
        "https://control.olympus.ncfritz.net/minerva/calendar/api/auth/callback",
      ),
    ).toBe(false);
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
      "minerva-calendar-console",
      "harpocrates-ca-console",
      "olympus-auth-tester",
    ]);
  });

  it("gives only the browser its refresh token in a cookie", () => {
    const cookie = CLIENTS.filter((c) => c.refreshToken === "cookie");
    expect(cookie.map((c) => c.id)).toEqual(["olympus-site"]);
  });
});

describe("Harpocrates's console's redirect URIs", () => {
  const harpocrates = clients.get("harpocrates-ca-console")!;

  it("accepts its service's callback, and only its own", () => {
    expect(harpocrates.refreshToken).toBe("body");
    expect(
      harpocrates.accepts(
        "https://control.olympus.ncfritz.net/harpocrates/ca/api/auth/callback",
      ),
    ).toBe(true);
    expect(
      harpocrates.accepts(
        "https://control.olympus.ncfritz.net/minerva/calendar/api/auth/callback",
      ),
    ).toBe(false);
  });
});
