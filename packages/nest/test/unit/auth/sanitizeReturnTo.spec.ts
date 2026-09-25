import { sanitizeReturnTo } from "../../../src/auth/sanitizeReturnTo";
import { describe, expect, it } from "vitest";

const WEB_APP_URL = "http://localhost:3001";

describe("sanitizeReturnTo", () => {
  it("allows a path on the configured web app origin", () => {
    expect(sanitizeReturnTo("/dashboard", WEB_APP_URL)).toBe(
      "http://localhost:3001/dashboard",
    );
  });

  it("allows the full web app URL itself", () => {
    expect(sanitizeReturnTo(WEB_APP_URL, WEB_APP_URL)).toBe(
      "http://localhost:3001/",
    );
  });

  it("rejects a different origin (open-redirect attempt)", () => {
    expect(
      sanitizeReturnTo("https://evil.example.com", WEB_APP_URL),
    ).toBeUndefined();
  });

  it("rejects a different port on the same host", () => {
    expect(
      sanitizeReturnTo("http://localhost:9999/", WEB_APP_URL),
    ).toBeUndefined();
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

  describe("when the web app is one console on the control host", () => {
    const CONSOLE_URL = "https://control.olympus.ncfritz.net/minerva/calendar";

    it("allows the console's own root", () => {
      expect(sanitizeReturnTo(CONSOLE_URL, CONSOLE_URL)).toBe(CONSOLE_URL);
    });

    it("allows a page inside the console", () => {
      expect(sanitizeReturnTo(`${CONSOLE_URL}/sync`, CONSOLE_URL)).toBe(
        `${CONSOLE_URL}/sync`,
      );
    });

    it("rejects another console on the same host", () => {
      expect(
        sanitizeReturnTo(
          "https://control.olympus.ncfritz.net/olympus/ca",
          CONSOLE_URL,
        ),
      ).toBeUndefined();
    });

    it("rejects a path that only starts the same way", () => {
      expect(
        sanitizeReturnTo(`${CONSOLE_URL}-archive/events`, CONSOLE_URL),
      ).toBeUndefined();
    });

    it("rejects the host's root", () => {
      expect(
        sanitizeReturnTo("https://control.olympus.ncfritz.net/", CONSOLE_URL),
      ).toBeUndefined();
    });

    it("still allows the whole origin when the web app has a name to itself", () => {
      expect(
        sanitizeReturnTo(
          "http://localhost:3001/anywhere",
          "http://localhost:3001/",
        ),
      ).toBe("http://localhost:3001/anywhere");
    });
  });

  it("returns undefined for a malformed returnTo", () => {
    expect(
      sanitizeReturnTo("http://[::not-a-valid-url", WEB_APP_URL),
    ).toBeUndefined();
  });
});
