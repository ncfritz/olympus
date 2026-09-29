/**
 * The settings `next build` compiles into the browser bundle.
 *
 * Nothing here is read at runtime, so these are properties of the image rather
 * than of the host running it, and a missing one is a mistake at build time or
 * it is never caught at all.
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
        "the bundle is built: apps/site/dev.env for `pnpm dev`, the site " +
        "target in docker-bake.hcl for the image.",
    );
  }
  return value;
};

/** Which environment the site says it is. `dev` when unset, as documented. */
export const ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT || "dev";

/**
 * The site's own public address, for the links and QR codes it shows people.
 * Not an API base: the API is same-origin, `/api/v1` (see auth/interceptors.ts).
 */
export const OLYMPUS_HOST = required(
  "NEXT_PUBLIC_OLYMPUS_HOST",
  process.env.NEXT_PUBLIC_OLYMPUS_HOST,
);

export const CONTENT_CDN_HOST = required(
  "NEXT_PUBLIC_CONTENT_CDN_HOST",
  process.env.NEXT_PUBLIC_CONTENT_CDN_HOST,
);

export const DIONYSUS_CDN_HOST = required(
  "NEXT_PUBLIC_DIONYSUS_CDN_HOST",
  process.env.NEXT_PUBLIC_DIONYSUS_CDN_HOST,
);

/**
 * The Maps JavaScript API key. A browser key is compiled into the bundle and
 * visible to anyone who loads a page, so it is not a secret to be kept; it is
 * restricted by HTTP referrer in the Google console instead.
 *
 * Not required, unlike the hosts: without it a map fails to draw, and nobody
 * mistakes a broken map for a working one. A wrong host looks like it works.
 */
export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
