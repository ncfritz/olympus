import { describe, expect, it } from "vitest";
import { CLIENT_ID, resolveSettings } from "../../src/settings";

describe("resolveSettings", () => {
  it("defaults to the workspace API and the home directory", () => {
    const settings = resolveSettings({}, {});
    expect(settings.apiBaseUrl).toBe("http://localhost:3001/v1");
    expect(settings.clientId).toBe(CLIENT_ID);
    expect(settings.provider).toBe("google");
    expect(settings.tokensPath).toMatch(/\.olympus[/\\]auth-tester\.json$/);
    // Any free port: a native client cannot reserve one.
    expect(settings.port).toBe(0);
  });

  it("prefers the flag to the environment", () => {
    const settings = resolveSettings(
      { OLYMPUS_API_BASE_URL: "http://from-env/v1" },
      { api: "http://from-flag/v1" },
    );
    expect(settings.apiBaseUrl).toBe("http://from-flag/v1");
  });

  /**
   * The flag exists so that a sign-off run against the border is the same
   * commands with one word added, rather than a URL somebody has to remember.
   */
  it("--external is the border's URL from the environment", () => {
    expect(
      resolveSettings(
        { OLYMPUS_EXTERNAL_API_BASE_URL: "https://olympus.ncfritz.net/api/v1" },
        { external: true },
      ).apiBaseUrl,
    ).toBe("https://olympus.ncfritz.net/api/v1");
  });

  it("refuses --external with nothing to point it at", () => {
    expect(() => resolveSettings({}, { external: true })).toThrow(
      /OLYMPUS_EXTERNAL_API_BASE_URL is not set/,
    );
  });

  it("refuses --external and --api together", () => {
    expect(() =>
      resolveSettings(
        { OLYMPUS_EXTERNAL_API_BASE_URL: "https://b/api/v1" },
        { external: true, api: "http://a/v1" },
      ),
    ).toThrow(/two different APIs/);
  });

  /**
   * Without the version every call is a 404 from the router, which reads as a
   * missing endpoint rather than a missing path segment.
   */
  it("insists the base URL carries the version, and suggests one", () => {
    expect(() => resolveSettings({}, { api: "http://localhost:3001" })).toThrow(
      "http://localhost:3001/v1",
    );
    expect(() => resolveSettings({}, { api: "olympus.test/v1" })).toThrow(
      /is not a URL/,
    );
  });

  /**
   * `localhost:3001/v1` is a URL as far as the parser is concerned --
   * "localhost:" is a scheme and "3001/v1" is the path -- so leaving the
   * scheme off passes every other check and fails later, looking like the
   * API's fault rather than a typo.
   */
  it("insists on http or https, which a missing scheme hides", () => {
    expect(() => resolveSettings({}, { api: "localhost:3001/v1" })).toThrow(
      /no http:\/\/ or https:\/\//,
    );
  });

  it("trims a trailing slash, so paths join cleanly", () => {
    expect(resolveSettings({}, { api: "http://a/v1/" }).apiBaseUrl).toBe(
      "http://a/v1",
    );
  });

  it("refuses a port that is not a number", () => {
    expect(() => resolveSettings({}, { port: "auto" })).toThrow(
      /--port must be a number/,
    );
  });
});
