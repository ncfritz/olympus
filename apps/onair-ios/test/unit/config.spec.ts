import { describe, expect, it } from "vitest";

import {
  API_BASE_URLS,
  apiBaseUrl,
  CLIENT_ID,
  REDIRECT_URI,
} from "../../src/config";

describe("config", () => {
  it("is the client the API registered, with its redirect", () => {
    // apps/api/src/auth/clients/clients.ts matches these exactly.
    expect(CLIENT_ID).toBe("olympus-ios");
    expect(REDIRECT_URI).toBe("olympus://auth");
  });

  it("uses the internal API until another is configured", () => {
    expect(apiBaseUrl(undefined)).toBe(API_BASE_URLS.internal);
    expect(apiBaseUrl("  ")).toBe(API_BASE_URLS.internal);
  });

  it("takes a configured API without its trailing slash", () => {
    expect(apiBaseUrl("http://192.168.1.10:3100/v1/")).toBe(
      "http://192.168.1.10:3100/v1",
    );
  });
});
