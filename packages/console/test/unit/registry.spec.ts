import { isClientName } from "@ncfritz/olympus-metrics";
import { describe, expect, it } from "vitest";
import {
  consoleApiPath,
  consoleClientName,
  consoleKey,
  consoleKeys,
  consolePath,
  consoleServiceName,
  findConsole,
  parseConsoleKey,
  PROPERTIES,
  type ConsoleKey,
} from "../../src/registry";
import { testRegistry } from "../support/registry";

describe("console keys", () => {
  it("reads a key's two halves", () => {
    expect(parseConsoleKey("minerva/calendar")).toEqual({
      property: "minerva",
      name: "calendar",
    });
  });

  it.each([
    ["minerva", "one half"],
    ["minerva/calendar/sync", "three halves"],
    ["Minerva/calendar", "upper case"],
    ["minerva/", "an empty half"],
    ["1minerva/calendar", "a leading digit"],
    ["minerva/calendar sync", "a space"],
  ])("rejects %s (%s)", (key) => {
    expect(parseConsoleKey(key)).toBeUndefined();
  });
});

describe("what a key derives", () => {
  const key = consoleKey("minerva", "calendar");

  it("is where the console and its agent are published", () => {
    expect(consolePath(key)).toBe("/minerva/calendar");
    expect(consoleApiPath(key)).toBe("/minerva/calendar/api");
  });

  it("is the image and Compose service names", () => {
    expect(consoleServiceName(key, "console")).toBe("minerva-calendar-console");
    expect(consoleServiceName(key, "agent")).toBe("minerva-calendar-agent");
  });

  it("is a usable metrics client name (ADR 0017)", () => {
    expect(consoleClientName(key)).toBe("minerva-calendar-console");
    expect(isClientName(consoleClientName(key))).toBe(true);
  });

  it("refuses to derive anything from a malformed key", () => {
    expect(() => consolePath("minerva" as never)).toThrow(/console key/);
  });
});

describe("the registry", () => {
  it("finds a console and the property it belongs to", () => {
    const found = findConsole(testRegistry, "minerva/calendar");
    expect(found?.property.label).toBe("Minerva");
    expect(found?.console.label).toBe("Calendar");
  });

  it("does not find one that is not there", () => {
    expect(findConsole(testRegistry, "dionysus/search")).toBeUndefined();
    // The type keeps this out of real code; the guard is for a key that
    // arrives as a string, from configuration.
    expect(findConsole(testRegistry, "nonsense" as ConsoleKey)).toBeUndefined();
  });

  it("lists its keys in the order they are rendered", () => {
    expect(consoleKeys(testRegistry)).toEqual([
      "olympus/notifications",
      "olympus/ca",
      "minerva/calendar",
    ]);
  });

  it("ships keys that are all well formed and unique", () => {
    const keys = consoleKeys(PROPERTIES);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(parseConsoleKey(key)).toBeDefined();
      expect(isClientName(consoleClientName(key))).toBe(true);
    }
  });
});
