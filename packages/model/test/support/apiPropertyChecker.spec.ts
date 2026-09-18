import * as path from "path";
import { describe, expect, it } from "vitest";
import { checkApiProperties } from "./apiPropertyChecker";

const fixture = path.join(__dirname, "..", "fixtures", "api-property");

describe("checkApiProperties", () => {
  const findings = checkApiProperties(fixture);
  const byProperty = new Map<string, string[]>();
  for (const f of findings) {
    const prop = f.target.split(".")[1];
    byProperty.set(prop, [...(byProperty.get(prop) ?? []), f.rule]);
  }

  it("accepts correctly documented properties", () => {
    const flaggedOk = [...byProperty.keys()].filter((p) => p.startsWith("ok"));
    expect(flaggedOk).toEqual([]);
  });

  it.each([
    ["missingDecorator", "missing-decorator"],
    ["requiredMissing", "required-missing"],
    ["requiredMismatch", "required-mismatch"],
    ["descriptionMissing", "description-missing"],
    ["arrayMismatch", "array-mismatch"],
    ["enumMismatch", "enum-mismatch"],
    ["enumNameMissing", "enumName-missing"],
    ["enumNameMismatch", "enumName-mismatch"],
    ["typeMismatchPrimitive", "type-mismatch"],
    ["typeMismatchClass", "type-mismatch"],
    ["typeObject", "type-object"],
    ["mapNotDocumented", "map-not-documented"],
    ["unionUnchecked", "union-unchecked"],
    ["timestampType", "timestamp-type"],
  ])("reports %s as %s", (prop, rule) => {
    expect(byProperty.get(prop)).toEqual([rule]);
  });
});
