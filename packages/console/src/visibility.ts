import { consoleKey, type Registry } from "./registry";

/**
 * The consoles a host actually runs, from CONTROL_CONSOLES: a
 * comma-separated list of `<property>/<console>` keys. Unset or empty
 * means the whole registry, which is what the workspace wants.
 *
 * The registry's order is kept whatever order the list is in, keys it
 * does not know are ignored (a host that names a console this image
 * predates should still start), and a property whose consoles are all
 * filtered out disappears with them.
 */
export const visibleConsoles = (
  registry: Registry,
  consoles: string | undefined,
): Registry => {
  const wanted = (consoles ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (wanted.length === 0) return registry;

  const allowed = new Set(wanted);
  return registry
    .map((property) => ({
      ...property,
      consoles: property.consoles.filter((entry) =>
        allowed.has(consoleKey(property.key, entry.key)),
      ),
    }))
    .filter((property) => property.consoles.length > 0);
};
