/**
 * Serializes a value with object keys sorted and `required` arrays sorted,
 * so snapshots don't change when only declaration order changes (for
 * example when properties move into a base class). All other arrays keep
 * their order, because order is meaningful (enum values, tuples).
 */
export const canonicalJson = (value: unknown): string =>
  `${JSON.stringify(normalize(value, ""), null, 2)}\n`;

const normalize = (value: unknown, key: string): unknown => {
  if (Array.isArray(value)) {
    const items = value.map((v) => normalize(v, ""));
    return key === "required" ? [...items].sort() : items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, normalize((value as Record<string, unknown>)[k], k)]),
    );
  }
  return value;
};
