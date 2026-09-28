import { AuthFlowError } from "./errors";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Bytes to base64url, by hand, for the same reason as the decoder below:
 * `Buffer` is Node's and `btoa` is the browser's, and this has to produce a
 * PKCE verifier on a phone.
 */
export const encodeBase64Url = (bytes: Uint8Array | number[]): string => {
  let out = "";
  for (let at = 0; at < bytes.length; at += 3) {
    const one = bytes[at]!;
    const two = bytes[at + 1];
    const three = bytes[at + 2];
    out += ALPHABET[one >> 2]!;
    out += ALPHABET[((one & 0x03) << 4) | ((two ?? 0) >> 4)]!;
    if (two === undefined) break;
    out += ALPHABET[((two & 0x0f) << 2) | ((three ?? 0) >> 6)]!;
    if (three === undefined) break;
    out += ALPHABET[three & 0x3f]!;
  }
  // No padding: base64url in a URL parameter carries none, and RFC 7636's
  // verifier has none either.
  return out;
};

/**
 * base64 as a platform produced it -- `expo-crypto` digests to base64 with
 * padding -- to the base64url a challenge has to be.
 */
export const base64ToBase64Url = (value: string): string =>
  value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * base64url to UTF-8, by hand.
 *
 * `Buffer` is Node's, `atob` is the browser's and React Native has neither
 * reliably, so a shared package that decodes a token either reaches for a
 * platform or does this. It is fifteen lines and a known-answer test.
 */
export const decodeBase64Url = (encoded: string): string => {
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const character of encoded) {
    const index = ALPHABET.indexOf(character);
    if (index === -1) {
      throw new AuthFlowError(`"${character}" is not base64url`);
    }
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return utf8(bytes);
};

/** UTF-8 bytes to a string, including the pairs above the BMP. */
const utf8 = (bytes: number[]): string => {
  let out = "";
  for (let at = 0; at < bytes.length; at += 1) {
    const byte = bytes[at]!;
    let point: number;
    let extra: number;
    if (byte < 0x80) {
      point = byte;
      extra = 0;
    } else if (byte >= 0xc0 && byte < 0xe0) {
      point = byte & 0x1f;
      extra = 1;
    } else if (byte >= 0xe0 && byte < 0xf0) {
      point = byte & 0x0f;
      extra = 2;
    } else if (byte >= 0xf0) {
      point = byte & 0x07;
      extra = 3;
    } else {
      throw new AuthFlowError("that is not UTF-8");
    }
    for (let more = 0; more < extra; more += 1) {
      at += 1;
      const next = bytes[at];
      if (next === undefined || (next & 0xc0) !== 0x80) {
        throw new AuthFlowError("that is not UTF-8");
      }
      point = (point << 6) | (next & 0x3f);
    }
    out +=
      point > 0xffff
        ? String.fromCharCode(
            0xd800 + ((point - 0x10000) >> 10),
            0xdc00 + ((point - 0x10000) & 0x3ff),
          )
        : String.fromCharCode(point);
  }
  return out;
};
