import { describe, expect, it } from "vitest";
import { canonicalJson } from "./support/canonical";
import { modelEnums } from "./support/exports";

/**
 * Enum values are persisted in Hasura and carried in RabbitMQ messages, so
 * changing or removing one is a data migration, not a refactor. This
 * snapshot makes every such change explicit in review.
 */
describe("model enums", () => {
  it("match the snapshot", async () => {
    await expect(
      canonicalJson(Object.fromEntries(modelEnums)),
    ).toMatchFileSnapshot("__snapshots__/enums.json");
  });
});
