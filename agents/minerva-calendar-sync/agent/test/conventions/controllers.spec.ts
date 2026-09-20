import * as path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadAllowList } from "../support/allowList";
import { checkControllers } from "../support/controllerRules";
import { type ControllerInfo, loadControllers } from "../support/controllers";

/**
 * Every controller follows docs/conventions/api.md (management operations)
 * or ADR 0016 (provider callbacks). Known exceptions live in
 * controllers.allow.json and may only shrink.
 */
describe("controller conventions", () => {
  let controllers: ControllerInfo[] = [];
  let unexpected: string[] = [];
  let stale: string[] = [];

  beforeAll(async () => {
    controllers = await loadControllers();
    ({ unexpected, stale } = loadAllowList(
      path.join(__dirname, "controllers.allow.json"),
      checkControllers(controllers),
    ));
  });

  it("finds the controllers", () => {
    expect(controllers.length).toBeGreaterThan(35);
  });

  it("has no findings outside the allow-list", () => {
    expect(unexpected).toEqual([]);
  });

  it("has no stale allow-list entries", () => {
    expect(stale).toEqual([]);
  });
});
