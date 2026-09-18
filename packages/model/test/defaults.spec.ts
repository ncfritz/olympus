import { DECORATORS } from "@nestjs/swagger";
import { describe, expect, it } from "vitest";
import { modelClasses } from "./support/exports";

type PropertyMetadata = { default?: unknown };

/**
 * A property with an initializer (`level = Level.INFO`) must document the
 * same value as its @ApiProperty `default`, or the SDK and the model
 * disagree about what an omitted value means.
 *
 * A documented default without an initializer is fine: the API applies
 * it. (The API builds plain objects rather than instances, so an
 * initializer only takes effect where code calls `new` on a model class.)
 */
describe("documented defaults", () => {
  const cases: [string, string, unknown, unknown][] = [];

  for (const [name, cls] of modelClasses) {
    let instance: Record<string, unknown>;
    try {
      instance = new (cls as new () => Record<string, unknown>)();
    } catch {
      continue;
    }
    const props: string[] =
      Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES_ARRAY,
        cls.prototype,
      ) ?? [];
    for (const key of props.map((p) => p.replace(/^:/, ""))) {
      const meta: PropertyMetadata | undefined = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        cls.prototype,
        key,
      );
      if (instance[key] !== undefined) {
        cases.push([name, key, meta?.default, instance[key]]);
      }
    }
  }

  it("finds the initialized properties", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)(
    "%s.%s: documented %j, initialized %j",
    (_c, _p, doc, init) => {
      expect(init).toEqual(doc);
    },
  );
});
