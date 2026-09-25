import { describe, expect, it } from "vitest";
import {
  isPublishedOverTls,
  sessionCookiePath,
} from "../../../src/auth/cookieScope";

describe("sessionCookiePath", () => {
  it.each([
    [
      "a console on a shared host",
      "https://control.olympus.ncfritz.net/minerva/calendar",
      "/minerva/calendar",
    ],
    [
      "a trailing slash",
      "https://control.olympus.ncfritz.net/minerva/calendar/",
      "/minerva/calendar",
    ],
    ["an app with a name to itself", "https://olympus.ncfritz.net", "/"],
    ["an app at the root path", "https://olympus.ncfritz.net/", "/"],
    ["nothing configured", undefined, "/"],
    ["something that is not a URL", "not a url", "/"],
  ])("%s -> %s", (_what, url, expected) => {
    expect(sessionCookiePath(url)).toBe(expected);
  });
});

describe("isPublishedOverTls", () => {
  it.each([
    ["https", "https://olympus.ncfritz.net", true],
    ["http", "http://olympus.ncfritz.net", false],
    // Read from the published URL rather than the request, because TLS is
    // terminated at nginx and the request arriving here is plain HTTP.
    ["something that is not a URL", "not a url", false],
  ])("%s -> %s", (_what, url, expected) => {
    expect(isPublishedOverTls(url)).toBe(expected);
  });
});
