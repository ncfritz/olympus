import { sanitizeReturnTo } from "../../../src/auth/sanitize-return-to";

const WEB_APP_URL = "http://localhost:3001";

describe("sanitizeReturnTo", () => {
  it("allows a path on the configured web app origin", () => {
    expect(sanitizeReturnTo("/dashboard", WEB_APP_URL)).toBe("http://localhost:3001/dashboard");
  });

  it("allows the full web app URL itself", () => {
    expect(sanitizeReturnTo(WEB_APP_URL, WEB_APP_URL)).toBe("http://localhost:3001/");
  });

  it("rejects a different origin (open-redirect attempt)", () => {
    expect(sanitizeReturnTo("https://evil.example.com", WEB_APP_URL)).toBeUndefined();
  });

  it("rejects a different port on the same host", () => {
    expect(sanitizeReturnTo("http://localhost:9999/", WEB_APP_URL)).toBeUndefined();
  });

  it("rejects a protocol-relative URL pointing elsewhere", () => {
    expect(sanitizeReturnTo("//evil.example.com", WEB_APP_URL)).toBeUndefined();
  });

  it("returns undefined when returnTo is absent", () => {
    expect(sanitizeReturnTo(undefined, WEB_APP_URL)).toBeUndefined();
  });

  it("returns undefined when WEB_APP_URL isn't configured", () => {
    expect(sanitizeReturnTo("/dashboard", undefined)).toBeUndefined();
  });

  it("returns undefined for a malformed returnTo", () => {
    expect(sanitizeReturnTo("http://[::not-a-valid-url", WEB_APP_URL)).toBeUndefined();
  });
});
