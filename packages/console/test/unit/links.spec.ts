import { describe, expect, it } from "vitest";
import { consoleHref } from "../../src/links";

describe("consoleHref", () => {
  it("is a path when the suite is this origin", () => {
    expect(consoleHref("minerva/calendar")).toBe("/minerva/calendar");
  });

  it("is absolute when the suite is somewhere else", () => {
    expect(
      consoleHref("minerva/calendar", "https://control.olympus.ncfritz.net"),
    ).toBe("https://control.olympus.ncfritz.net/minerva/calendar");
  });

  it("does not double a slash on an origin that has one", () => {
    expect(consoleHref("olympus/ca", "https://control.example/")).toBe(
      "https://control.example/olympus/ca",
    );
  });
});
