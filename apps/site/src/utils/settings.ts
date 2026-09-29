/**
 * Reading the settings `next build` compiles in, and refusing the ones that
 * cannot be trusted. Separate from constants.ts, which is where they are
 * actually read: this file has no environment in it, so it can be tested.
 */

/**
 * A setting the bundle must not be built without.
 *
 * The hosts below say where data comes from, and the fallbacks they used to
 * carry were the development ones -- so a production build with a mistyped or
 * forgotten argument produced a working site quietly pointed at dev. Throwing
 * here fails `next build`, which is the last moment this is cheap.
 */
export const required = (name: string, value: string | undefined): string => {
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set. The site compiles it in, so it has to be set where ` +
        "the bundle is built: apps/site/dev.env for `pnpm dev`, " +
        "infra/docker/env/<env>.env for the image.",
    );
  }
  // With the scheme. These are concatenated with paths rather than parsed as
  // hostnames, so `cdn.example:9443/assets/x` is read as a URL whose scheme is
  // `cdn.example` -- which fails at the fetch, far from the setting that caused
  // it. The names end in _HOST, which is exactly what invites the mistake.
  if (!/^https?:\/\//.test(value)) {
    throw new Error(
      `${name} is "${value}", which has no scheme. It is joined to paths as ` +
        "it stands, so it needs to be an absolute URL: https://host[:port].",
    );
  }
  return value;
};
