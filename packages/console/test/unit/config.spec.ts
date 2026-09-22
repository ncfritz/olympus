import { describe, expect, it } from "vitest";
import { readShellConfig } from "../../src/config";
import { consoleKeys, PROPERTIES } from "../../src/registry";
import { testRegistry } from "../support/registry";

describe("readShellConfig", () => {
  it("is the whole registry on a host that names no consoles", () => {
    const config = readShellConfig({}, testRegistry);
    expect(consoleKeys(config.nav)).toEqual(consoleKeys(testRegistry));
    expect(config.origin).toBeUndefined();
  });

  it("narrows the sidebar to what the host runs", () => {
    const config = readShellConfig(
      { CONTROL_CONSOLES: "minerva/calendar" },
      testRegistry,
    );
    expect(consoleKeys(config.nav)).toEqual(["minerva/calendar"]);
  });

  it("carries the suite's origin when there is one", () => {
    const config = readShellConfig(
      { CONTROL_ORIGIN: "https://control.olympus.ncfritz.net" },
      testRegistry,
    );
    expect(config.origin).toBe("https://control.olympus.ncfritz.net");
  });

  it("refuses an origin that is not a URL rather than quietly dropping it", () => {
    expect(() =>
      readShellConfig({ CONTROL_ORIGIN: "control.olympus" }, testRegistry),
    ).toThrow(/CONTROL_ORIGIN/);
  });

  it("defaults to the registry the package ships", () => {
    expect(consoleKeys(readShellConfig({}).nav)).toEqual(
      consoleKeys(PROPERTIES),
    );
  });
});
