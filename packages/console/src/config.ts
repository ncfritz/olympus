import { PROPERTIES, type Registry } from "./registry";
import { visibleConsoles } from "./visibility";

/** What a console's root layout hands the shell. */
export interface ShellConfig {
  /** The consoles this host runs, in registry order. */
  nav: Registry;
  /** Where the suite is, when it is somewhere other than this origin. */
  origin?: string;
}

export interface ShellEnvironment {
  CONTROL_CONSOLES?: string;
  CONTROL_ORIGIN?: string;
  // Everything else a process environment carries. Without it this is a
  // weak type, and `process.env` — which Next.js narrows to the variables
  // it knows about — has nothing in common with it.
  [key: string]: string | undefined;
}

/**
 * Resolves the shell's configuration from the environment. This is the
 * one thing about a console that is *not* baked into its image: the base
 * path is a build-time Next.js setting, but which consoles a host runs
 * changes with the host, so it is read at runtime in the root layout (a
 * server component) and passed down.
 *
 * A malformed CONTROL_ORIGIN throws rather than being dropped: a
 * sidebar whose links quietly point at the wrong place is worse than a
 * console that refuses to render.
 */
export const readShellConfig = (
  env: ShellEnvironment = process.env,
  registry: Registry = PROPERTIES,
): ShellConfig => {
  const origin = env.CONTROL_ORIGIN?.trim();
  if (origin) {
    try {
      new URL(origin);
    } catch {
      throw new Error(
        `CONTROL_ORIGIN is not a URL: "${origin}" (expected something like https://control.olympus.ncfritz.net)`,
      );
    }
  }
  return {
    nav: visibleConsoles(registry, env.CONTROL_CONSOLES),
    origin: origin || undefined,
  };
};
