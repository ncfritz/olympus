import * as path from "path";
import { describe, expect, it } from "vitest";
import { loadAllowList } from "../support/allowList";
import { checkControllers } from "../support/controllerRules";
import { controllers, otherSources } from "../support/controllers";

/**
 * Every controller follows docs/conventions/api.md. Known exceptions live
 * in controllers.allow.json and may only shrink.
 */
describe("API controller conventions", () => {
  const findings = checkControllers(controllers, otherSources);
  const { unexpected, stale } = loadAllowList(
    path.join(__dirname, "controllers.allow.json"),
    findings,
  );

  it("finds the controllers", () => {
    expect(controllers.length).toBeGreaterThan(150);
  });

  it("has no findings outside the allow-list", () => {
    expect(unexpected).toEqual([]);
  });

  it("has no stale allow-list entries", () => {
    expect(stale).toEqual([]);
  });
});
