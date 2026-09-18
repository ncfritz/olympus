import type { Type } from "@nestjs/common";
import * as model from "../../src";

type EnumObject = Record<string, string | number>;

const isClass = (value: unknown): value is Type<unknown> =>
  typeof value === "function" &&
  /^class[\s{]/.test(Function.prototype.toString.call(value));

const isEnum = (value: unknown): value is EnumObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (v) => typeof v === "string" || typeof v === "number",
  );

const entries: [string, unknown][] = Object.entries(model).sort(([a], [b]) =>
  a.localeCompare(b),
);

/** Every exported class, by export name. */
export const modelClasses = entries.filter((e): e is [string, Type<unknown>] =>
  isClass(e[1]),
);

/** Every exported TypeScript enum, by export name. */
export const modelEnums = entries.filter((e): e is [string, EnumObject] =>
  isEnum(e[1]),
);
