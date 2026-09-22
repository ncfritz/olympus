import { describe, expect, it } from "vitest";
import { consoleKeys } from "../../src/registry";
import { visibleConsoles } from "../../src/visibility";
import { testRegistry } from "../support/registry";

describe("visibleConsoles", () => {
  it("is the whole registry when the host says nothing", () => {
    expect(visibleConsoles(testRegistry, undefined)).toEqual(testRegistry);
    expect(visibleConsoles(testRegistry, "")).toEqual(testRegistry);
    expect(visibleConsoles(testRegistry, "  ")).toEqual(testRegistry);
  });

  it("keeps only what the host runs", () => {
    const visible = visibleConsoles(
      testRegistry,
      "minerva/calendar,olympus/ca",
    );
    expect(consoleKeys(visible)).toEqual(["olympus/ca", "minerva/calendar"]);
  });

  it("keeps the registry's order, not the list's", () => {
    const visible = visibleConsoles(
      testRegistry,
      "minerva/calendar, olympus/notifications",
    );
    expect(consoleKeys(visible)).toEqual([
      "olympus/notifications",
      "minerva/calendar",
    ]);
  });

  it("drops a property whose consoles are all filtered out", () => {
    const visible = visibleConsoles(testRegistry, "minerva/calendar");
    expect(visible.map((property) => property.key)).toEqual(["minerva"]);
  });

  it("ignores a console it has never heard of", () => {
    const visible = visibleConsoles(
      testRegistry,
      "minerva/calendar,minerva/documents",
    );
    expect(consoleKeys(visible)).toEqual(["minerva/calendar"]);
  });
});
