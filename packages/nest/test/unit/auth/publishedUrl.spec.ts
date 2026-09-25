import { describe, expect, it } from "vitest";
import { publishedUrl } from "../../../src/auth/publishedUrl";

const CONSOLE_API = "https://control.olympus.ncfritz.net/minerva/calendar/api";

describe("publishedUrl", () => {
  it("keeps the path the agent is published at", () => {
    expect(publishedUrl(CONSOLE_API, "auth/callback/google").href).toBe(
      `${CONSOLE_API}/auth/callback/google`,
    );
  });

  it("does not let a leading slash throw that path away", () => {
    // `new URL("/auth/callback/google", base)` resolves against the origin,
    // which is how the provider came to be sent a redirect_uri nothing
    // serves.
    expect(publishedUrl(CONSOLE_API, "/auth/callback/google").href).toBe(
      `${CONSOLE_API}/auth/callback/google`,
    );
  });

  it("keeps the query, so a callback's code and state survive", () => {
    expect(
      publishedUrl(CONSOLE_API, "/auth/callback/google?code=abc&state=xyz")
        .href,
    ).toBe(`${CONSOLE_API}/auth/callback/google?code=abc&state=xyz`);
  });

  it("tolerates a base that ends in a slash", () => {
    expect(publishedUrl(`${CONSOLE_API}/`, "auth/callback/google").href).toBe(
      `${CONSOLE_API}/auth/callback/google`,
    );
  });

  it("is the plain path when the agent has a name to itself", () => {
    expect(
      publishedUrl("http://localhost:4432", "/auth/callback/google").href,
    ).toBe("http://localhost:4432/auth/callback/google");
  });

  it("does not confuse a deeper path with a sibling", () => {
    expect(publishedUrl(CONSOLE_API, "v1/calendars").href).toBe(
      `${CONSOLE_API}/v1/calendars`,
    );
  });
});
