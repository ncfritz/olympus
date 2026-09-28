import { describe, expect, it } from "vitest";
import {
  baseUrlOf,
  isResolved,
  resolve,
  type Target,
} from "../../src/endpoints";

const url = (target: Target): string => {
  const answer = resolve(target);
  if (!isResolved(answer)) throw new Error(answer.problem);
  return answer.baseUrl;
};

const problem = (target: Target): string => {
  const answer = resolve(target);
  if (isResolved(answer)) throw new Error(`resolved to ${answer.baseUrl}`);
  return answer.problem;
};

describe("resolve", () => {
  /** nginx publishes the API under /api, and every client carries the version. */
  it("puts the named environments behind https and /api/v1", () => {
    expect(url({ kind: "named", name: "production" })).toBe(
      "https://olympus.ncfritz.net/api/v1",
    );
    expect(url({ kind: "named", name: "internal" })).toBe(
      "https://olympus.internal.ncfritz.net/api/v1",
    );
    expect(url({ kind: "named", name: "dev" })).toBe(
      "https://olympus.dev.ncfritz.net/api/v1",
    );
  });

  it("takes a custom host with the protocol chosen", () => {
    expect(
      url({
        kind: "custom",
        protocol: "http",
        host: "192.168.1.10",
        port: "3001",
        path: "/v1",
      }),
    ).toBe("http://192.168.1.10:3001/v1");
    expect(
      url({
        kind: "custom",
        protocol: "https",
        host: "Olympus.Test",
        path: "/api/v1",
      }),
    ).toBe("https://olympus.test/api/v1");
  });

  /**
   * An API run from the workspace serves `/v1` itself; the `/api` in front of
   * the named hosts is nginx's. The wrong one is a 404 from the router or from
   * nginx, and neither of them says which mistake it was.
   */
  it("puts the API where it actually answers", () => {
    const laptop = {
      kind: "custom",
      protocol: "http",
      host: "192.168.1.10",
      port: "3001",
    } as const;
    expect(url({ ...laptop, path: "/v1" })).toBe("http://192.168.1.10:3001/v1");
    expect(url({ ...laptop, path: "/api/v1" })).toBe(
      "http://192.168.1.10:3001/api/v1",
    );
  });

  /** Settings stored before the path was a choice meant a direct API. */
  it("defaults a custom target to /v1 when no path was stored", () => {
    expect(url({ kind: "custom", protocol: "http", host: "10.0.0.2" })).toBe(
      "http://10.0.0.2/v1",
    );
  });

  /** `192.168.1.10:3001` is what a phone keyboard produces in one field. */
  it("takes the port from the host when it is typed there", () => {
    expect(
      url({ kind: "custom", protocol: "http", host: " 192.168.1.10:3001 " }),
    ).toBe("http://192.168.1.10:3001/v1");
  });

  it("prefers a port typed in the host to one left in the port field", () => {
    expect(
      url({
        kind: "custom",
        protocol: "http",
        host: "10.0.0.2:8080",
        port: "3001",
      }),
    ).toBe("http://10.0.0.2:8080/v1");
  });

  it("says what is wrong rather than building a URL that cannot work", () => {
    expect(problem({ kind: "custom", protocol: "http", host: "  " })).toMatch(
      /host or address is needed/,
    );
    expect(
      problem({ kind: "custom", protocol: "https", host: "olympus.test/api" }),
    ).toMatch(/not a host name or an address/);
    expect(
      problem({ kind: "custom", protocol: "http", host: "10.0.0.2:one" }),
    ).toMatch(/not a port/);
    expect(
      problem({
        kind: "custom",
        protocol: "http",
        host: "10.0.0.2",
        port: "70000",
      }),
    ).toMatch(/between 1 and 65535/);
    expect(
      problem({ kind: "custom", protocol: "http", host: "10.0.0.2:1:2" }),
    ).toMatch(/more than one port/);
  });

  /**
   * App Transport Security refuses cleartext to anything but the local network
   * once NSAllowsLocalNetworking is set, and it refuses it before the request
   * leaves the phone -- which looks like the server being down.
   */
  it("warns about cleartext to a host iOS will not allow it to", () => {
    const answer = resolve({
      kind: "custom",
      protocol: "http",
      host: "olympus.ncfritz.net",
    });
    expect(isResolved(answer) && answer.warning).toMatch(/refuses cleartext/);
  });

  it.each([
    "localhost",
    "127.0.0.1",
    "10.0.0.2",
    "192.168.1.10",
    "172.16.0.9",
    "furball.local",
  ])("does not warn about cleartext to %s, which is local", (host: string) => {
    const answer = resolve({ kind: "custom", protocol: "http", host });
    expect(isResolved(answer) && answer.warning).toBeUndefined();
  });

  it("does not warn about https anywhere", () => {
    const answer = resolve({
      kind: "custom",
      protocol: "https",
      host: "olympus.ncfritz.net",
    });
    expect(isResolved(answer) && answer.warning).toBeUndefined();
  });
});

describe("baseUrlOf", () => {
  it("is the URL when there is one", () => {
    expect(baseUrlOf({ kind: "named", name: "dev" })).toBe(
      "https://olympus.dev.ncfritz.net/api/v1",
    );
  });

  it("is nothing when the target does not resolve", () => {
    expect(
      baseUrlOf({ kind: "custom", protocol: "http", host: "" }),
    ).toBeUndefined();
  });

  /** A warning is not a refusal: the URL still comes back. */
  it("is the URL even when it comes with a warning", () => {
    expect(
      baseUrlOf({
        kind: "custom",
        protocol: "http",
        host: "olympus.ncfritz.net",
        path: "/api/v1",
      }),
    ).toBe("http://olympus.ncfritz.net/api/v1");
  });
});
