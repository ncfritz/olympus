import type { FlowCrypto } from "@ncfritz/olympus-auth-flow";
import { base64ToBase64Url } from "@ncfritz/olympus-auth-flow";

/**
 * PKCE's two primitives, from the Web Crypto API.
 *
 * `crypto.subtle` exists only in a secure context, which for this site means
 * https everywhere but `localhost` -- the browser withholds it rather than
 * failing the call, so the absence has to be reported as itself.
 */
export const browserCrypto: FlowCrypto = {
  randomBase64Url: (bytes) => {
    const buffer = new Uint8Array(bytes);
    subtle().getRandomValues(buffer);
    return base64ToBase64Url(btoa(String.fromCharCode(...buffer)));
  },

  sha256Base64Url: async (text) => {
    const digest = await subtle().subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    return base64ToBase64Url(
      btoa(String.fromCharCode(...new Uint8Array(digest))),
    );
  },
};

const subtle = (): Crypto => {
  if (typeof crypto === "undefined" || crypto.subtle === undefined) {
    throw new Error(
      "Web Crypto is unavailable: this page is not in a secure context, so PKCE cannot be used. Serve the site over https, or use localhost.",
    );
  }
  return crypto;
};
