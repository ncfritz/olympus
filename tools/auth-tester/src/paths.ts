/**
 * Where the API's routes are, under the version in the base URL.
 *
 * Each domain's feature modules are served under the domain's own prefix
 * (`RouterModule.register` in the API's AppModule), so ping is
 * `/olympus/ping`. Authentication is registered outside those, at `/auth`,
 * and the key set is at `/.well-known`. Nothing else is served at the root --
 * which is worth saying out loud, because a path with the prefix left off
 * answers 404 and reads as a missing endpoint.
 */
const PREFIXES = ["olympus", "dionysus", "minerva", "auth", ".well-known"];

/** What to add to a 404, when the path looks like it lost its prefix. */
export const missingPrefix = (path: string): string | undefined => {
  const first = path.replace(/^\/+/, "").split("/")[0];
  if (first === undefined || first === "" || PREFIXES.includes(first)) {
    return undefined;
  }
  return `Nothing is served at /${first} itself: a domain's endpoints are under /olympus, /dionysus or /minerva (so /olympus/ping, not /ping), and authentication is at /auth.`;
};
