import { describe, expect, it } from "vitest";
import {
  sessionCookieOptions,
  sessionCookiePath,
} from "../../../src/auth/sessionCookie";

describe("sessionCookiePath", () => {
  it("is the console's own path on the control host", () => {
    expect(
      sessionCookiePath("https://control.olympus.ncfritz.net/minerva/calendar"),
    ).toBe("/minerva/calendar");
  });

  it("covers the agent, which is published under the console", () => {
    const path = sessionCookiePath(
      "https://control.olympus.ncfritz.net/minerva/calendar",
    );
    expect("/minerva/calendar/api/v1/calendars".startsWith(`${path}/`)).toBe(
      true,
    );
  });

  it("ignores a trailing slash", () => {
    expect(sessionCookiePath("https://control.example/minerva/calendar/")).toBe(
      "/minerva/calendar",
    );
  });

  it("is the whole origin for a web app with a name to itself", () => {
    expect(sessionCookiePath("http://localhost:4392")).toBe("/");
    expect(sessionCookiePath("http://localhost:4392/")).toBe("/");
  });

  it("falls back to the whole origin when there is nothing to go on", () => {
    expect(sessionCookiePath(undefined)).toBe("/");
    expect(sessionCookiePath("not-a-url")).toBe("/");
  });
});

describe("sessionCookieOptions", () => {
  it("keeps the cookie out of scripts and off other sites", () => {
    const options = sessionCookieOptions("http://localhost:4392", false);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
  });

  it("marks the cookie secure over TLS", () => {
    expect(
      sessionCookieOptions("https://control.example/olympus/ca", true),
    ).toMatchObject({ secure: true, path: "/olympus/ca" });
  });
});
