export const ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT || "dev";

export const OLYMPUS_HOST =
  process.env.NEXT_PUBLIC_OLYMPUS_HOST || "https://olympus.dev.ncfritz.net";

export const CONTENT_CDN_HOST =
  process.env.NEXT_PUBLIC_CONTENT_CDN_HOST ||
  "https://content-cdn.dev.ncfritz.net:9443";

export const DIONYSUS_CDN_HOST =
  process.env.NEXT_PUBLIC_DIONYSUS_CDN_HOST ||
  "https://dionysus-cdn.dev.ncfritz.net";

// The Maps JavaScript API key. A browser key is compiled into the bundle and
// visible to anyone who loads a page, so it is not a secret to be kept; it is
// restricted by HTTP referrer in the Google console instead. Empty when unset,
// which is how @vis.gl/react-google-maps is told there is no key.
export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
