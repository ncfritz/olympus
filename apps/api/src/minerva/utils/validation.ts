/**
 * Checks shared by the Minerva services (goals, reviews). The global
 * ValidationPipe is off (docs/conventions/model.md), and these values reach
 * the database, so the services check them and collect every problem
 * before answering 400.
 */

const COLOR = /^#[0-9a-f]{6}$/;

/** A trimmed name of 1 to `max` characters. */
export const checkName = (
  value: unknown,
  problems: string[],
  max = 50,
): string => {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > max) {
    problems.push(`name must be 1 to ${max} characters`);
  }
  return name;
};

/** A hex colour, stored lowercase. */
export const checkColor = (value: unknown, problems: string[]): string => {
  const color = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!COLOR.test(color)) {
    problems.push("color must be a hex colour such as #52c41a");
  }
  return color;
};

/** Optional text of at most `max` characters; empty or null is none. */
export const checkOptionalText = (
  value: unknown,
  name: string,
  max: number,
  problems: string[],
): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > max) {
    problems.push(`${name} must be text of at most ${max} characters`);
    return null;
  }
  return value.trim() || null;
};

/** One of an enum's values. */
export const checkEnum = <T extends string>(
  value: unknown,
  values: Record<string, T>,
  name: string,
  problems: string[],
): T => {
  const allowed = Object.values(values);
  if (!allowed.includes(value as T)) {
    problems.push(`${name} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
};

/** A whole number from `min` to `max`. */
export const checkInteger = (
  value: unknown,
  name: string,
  min: number,
  max: number,
  problems: string[],
): number => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    problems.push(`${name} must be a whole number from ${min} to ${max}`);
    return min;
  }
  return value;
};

/** A list of strings, as reorder operations take. */
export const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Whether `value` is a UUID, as IDs are. */
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

/** A finite number from `min` to `max` (inclusive unless `exclusiveMin`). */
export const checkNumber = (
  value: unknown,
  name: string,
  problems: string[],
  {
    min,
    max,
    exclusiveMin = false,
  }: { min?: number; max?: number; exclusiveMin?: boolean } = {},
): number => {
  const ok =
    typeof value === "number" &&
    Number.isFinite(value) &&
    (min === undefined || (exclusiveMin ? value > min : value >= min)) &&
    (max === undefined || value <= max);
  if (!ok) {
    const range =
      min !== undefined && max !== undefined
        ? ` ${exclusiveMin ? "above" : "from"} ${min} ${exclusiveMin ? "and at most" : "to"} ${max}`
        : "";
    problems.push(`${name} must be a number${range}`);
    return min ?? 0;
  }
  return value;
};
