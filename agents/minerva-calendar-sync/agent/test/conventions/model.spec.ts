import * as path from "path";
import { describe, expect, it } from "vitest";
import { loadAllowList } from "../support/allowList";
import { checkApiProperties } from "../support/apiPropertyChecker";

/**
 * Every property of the management API's request and response shapes
 * (src/model) has an @ApiProperty that agrees with its declared type
 * (docs/conventions/model.md). Known exceptions live in model.allow.json
 * and may only shrink.
 */
describe("model conventions", () => {
  const findings = checkApiProperties(
    path.resolve(__dirname, "../.."),
    "src/model",
  ).map((f) => ({ ...f, message: `${f.location}: ${f.message}` }));
  const { unexpected, stale } = loadAllowList(
    path.join(__dirname, "model.allow.json"),
    findings,
  );

  it("has no findings outside the allow-list", () => {
    expect(unexpected).toEqual([]);
  });

  it("has no stale allow-list entries", () => {
    expect(stale).toEqual([]);
  });
});
