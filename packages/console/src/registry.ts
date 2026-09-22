/**
 * The suite's map: which consoles exist, what they are called, and where
 * they are published ([ADR 0021](../../../docs/decisions/0021-control-host-and-console-navigation.md)).
 *
 * It is compiled into every console image, so every console's sidebar
 * shows the same thing; a host narrows it to what it runs with
 * CONTROL_CONSOLES (see `readShellConfig`). Because ADR 0019 builds and
 * deploys every image at one git tag, the consoles cannot drift apart.
 *
 * An entry is added when its console is built, not when it is planned: a
 * menu row that 404s is worse than a short menu.
 */

/** A console, within its property. */
export interface ConsoleEntry {
  /** Unique within its property, lower case: `calendar`. */
  key: string;
  label: string;
  /** One line: the sidebar's tooltip and the index's card. */
  description: string;
}

/** A major property of the platform, and its consoles. */
export interface PropertyEntry {
  /** Unique, lower case: `minerva`. */
  key: string;
  label: string;
  consoles: ConsoleEntry[];
}

export type Registry = PropertyEntry[];

/**
 * `<property>/<console>`, the one identifier everything else is derived
 * from: the path, the image and Compose service names, and the metrics
 * client name.
 */
export type ConsoleKey = `${string}/${string}`;

/** Keys are path segments, and become Docker image and metrics client names. */
const SEGMENT = /^[a-z][a-z0-9-]*$/;

const isSegment = (value: string): boolean => SEGMENT.test(value);

export const consoleKey = (property: string, name: string): ConsoleKey =>
  `${property}/${name}`;

/** The two halves of a key, or `undefined` if it is not one. */
export const parseConsoleKey = (
  key: string,
): { property: string; name: string } | undefined => {
  const parts = key.split("/");
  if (parts.length !== 2) return undefined;
  const [property, name] = parts;
  if (!isSegment(property) || !isSegment(name)) return undefined;
  return { property, name };
};

const halves = (key: ConsoleKey): { property: string; name: string } => {
  const parsed = parseConsoleKey(key);
  if (!parsed) throw new Error(`Not a console key: "${key}"`);
  return parsed;
};

/** Where the console is published on the control host: `/minerva/calendar`. */
export const consolePath = (key: ConsoleKey): string => {
  const { property, name } = halves(key);
  return `/${property}/${name}`;
};

/** Where its agent is published: `/minerva/calendar/api`. */
export const consoleApiPath = (key: ConsoleKey): string =>
  `${consolePath(key)}/api`;

/**
 * The Docker image and Compose service name of one half of a console:
 * `minerva-calendar-console`, `minerva-calendar-agent`.
 */
export const consoleServiceName = (
  key: ConsoleKey,
  role: "console" | "agent",
): string => {
  const { property, name } = halves(key);
  return `${property}-${name}-${role}`;
};

/**
 * The console's `X-Olympus-Client` value and metrics `client` label
 * (ADR 0017), which is its service name.
 */
export const consoleClientName = (key: ConsoleKey): string =>
  consoleServiceName(key, "console");

/** The property and console a key names, if the registry has it. */
export const findConsole = (
  registry: Registry,
  key: ConsoleKey,
): { property: PropertyEntry; console: ConsoleEntry } | undefined => {
  const parsed = parseConsoleKey(key);
  if (!parsed) return undefined;
  const property = registry.find(
    (candidate) => candidate.key === parsed.property,
  );
  const entry = property?.consoles.find(
    (candidate) => candidate.key === parsed.name,
  );
  return property && entry ? { property, console: entry } : undefined;
};

/** Every key in a registry, in the order it is rendered. */
export const consoleKeys = (registry: Registry): ConsoleKey[] =>
  registry.flatMap((property) =>
    property.consoles.map((entry) => consoleKey(property.key, entry.key)),
  );

export const PROPERTIES: Registry = [
  {
    key: "minerva",
    label: "Minerva",
    consoles: [
      {
        key: "calendar",
        label: "Calendar",
        description:
          "Calendar accounts, synced calendars, availability overrides and publishing",
      },
    ],
  },
];
