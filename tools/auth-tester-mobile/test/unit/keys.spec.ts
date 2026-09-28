import { describe, expect, it } from "vitest";
import { presenceKey, slug, tokensKey } from "../../src/keys";

/** SecureStore keys hold alphanumerics, `.`, `-` and `_`, and nothing else. */
const ALLOWED = /^[A-Za-z0-9.\-_]+$/;

describe("keys", () => {
  const urls = [
    "https://olympus.ncfritz.net/api/v1",
    "https://olympus.internal.ncfritz.net/api/v1",
    "http://192.168.1.10:3001/api/v1",
  ];

  it("are acceptable to SecureStore", () => {
    for (const url of urls) {
      expect(tokensKey(url)).toMatch(ALLOWED);
      expect(presenceKey(url)).toMatch(ALLOWED);
    }
  });

  /** Each API keeps its own tokens, so switching target signs nothing out. */
  it("differ per API", () => {
    const keys = new Set(urls.map(tokensKey));
    expect(keys.size).toBe(urls.length);
  });

  /** A run of punctuation is one dash: `https://` would otherwise be `https---`. */
  it("keep the URL readable, because a key you can read is worth more", () => {
    expect(tokensKey("https://olympus.dev.ncfritz.net/api/v1")).toBe(
      "tokens.https-olympus.dev.ncfritz.net-api-v1",
    );
    expect(tokensKey("http://192.168.1.10:3001/api/v1")).toBe(
      "tokens.http-192.168.1.10-3001-api-v1",
    );
  });

  it("marks presence beside the tokens it is about", () => {
    const url = urls[0]!;
    expect(presenceKey(url)).toBe(`${tokensKey(url)}.present`);
  });

  it("leaves what is already allowed alone", () => {
    expect(slug("a.b-c_d9")).toBe("a.b-c_d9");
  });
});
