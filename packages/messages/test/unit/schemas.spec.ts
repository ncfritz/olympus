import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { generate, SCHEMAS } from "../../scripts/generate-schemas.mjs";

describe("generated JSON Schemas", () => {
  it.each(Object.keys(SCHEMAS))("%s is up to date (pnpm schemas)", (file) => {
    const committed = readFileSync(
      join(__dirname, "../../schemas", file),
      "utf8",
    );
    expect(committed).toBe(generate(file));
  });
});
