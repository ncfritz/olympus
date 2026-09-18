import { generateSchema, type SchemaObject } from "@nestjs/swagger";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./support/canonical";
import { modelClasses } from "./support/exports";

/**
 * Snapshot of the OpenAPI schema produced for every exported model class.
 *
 * This is the safety net for refactoring the model: a change that is meant
 * to be structural only (new decorator helpers, base classes, import
 * cleanup) must leave this snapshot unchanged. A change that alters the API
 * contract updates the snapshot, and the diff shows exactly what the SDK
 * will see.
 */
describe("model OpenAPI schemas", () => {
  it("match the snapshot", async () => {
    const schemas: Record<string, SchemaObject> = {};
    for (const [, cls] of modelClasses) {
      Object.assign(schemas, generateSchema(cls, schemas).schemas);
    }
    await expect(canonicalJson(schemas)).toMatchFileSnapshot(
      "__snapshots__/schemas.json",
    );
  });

  it("has one schema per exported class name", () => {
    const names = modelClasses.map(([, cls]) => cls.name);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    expect(duplicates).toEqual([]);
  });
});
