import { publishedUrl } from "@ncfritz/olympus-nest";
import { Inject, Injectable } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { authConfig, type AuthConfigType } from "../../../config/configuration";

/** How long an image URL handed to the viewer can be fetched. */
export const IMAGE_TOKEN_TTL_SECONDS = 60 * 60;

const base64url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");

/** What the browser reads an attribute's value as: the entities a URL has. */
const decodeAttribute = (value: string) =>
  value
    .replace(/&amp;|&#0*38;|&#x0*26;/gi, "&")
    .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .trim();

/** An absolute http(s) URL, a protocol-relative one taken as https. */
const remote = (value: string): string | undefined => {
  const url = value.startsWith("//") ? `https:${value}` : value;
  return /^https?:\/\//i.test(url) ? url : undefined;
};

/** The elements whose attributes name an image to show. */
const IMAGE_TAGS = /<(img|input|video|body|table|td|th|tr)\b[^>]*>/gi;
const IMAGE_ATTRIBUTES =
  /(\s(?:src|background|poster)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const SRCSET = /(\ssrcset\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi;
/** CSS's url(), in a style attribute or a style element. */
const CSS_URL = /url\(\s*(["']?)((?:https?:)?\/\/[^"')\s]+)\1\s*\)/gi;
const CSS_URL_ENTITY =
  /url\(\s*(&quot;|&#0*39;)((?:https?:)?\/\/[^"')\s&]+(?:&amp;[^"')\s&]+)*)\1\s*\)/gi;

/**
 * Remote images in a message, fetched by the API instead of the browser
 * (docs/plans/email-management phase 5): the HTML's image URLs are
 * rewritten to this API's ProxyMailImage, each signed so the endpoint
 * fetches only what a message the user opened named, and only for
 * IMAGE_TOKEN_TTL_SECONDS. The key is made when the API starts and never
 * leaves it: a restart ends every open message's images, which a reopen
 * signs again.
 *
 * Off without AUTH_PUBLIC_BASE_URL, which says where the browser reaches
 * the API; the viewer's frame then loads no remote image, as before.
 */
@Injectable()
export class MailImageProxy {
  private readonly key = randomBytes(32);

  constructor(@Inject(authConfig.KEY) private readonly auth: AuthConfigType) {}

  /** Where the rewritten images are, which the frame's policy allows. */
  get baseUrl(): string | undefined {
    const base = this.auth?.users?.publicBaseUrl;
    return base
      ? publishedUrl(base, "/v1/minerva/mail/image/").href
      : undefined;
  }

  /** A token naming `url`, good until the TTL is out. */
  sign(url: string, now = Date.now()): string {
    const expires = Math.floor(now / 1000) + IMAGE_TOKEN_TTL_SECONDS;
    const payload = base64url(JSON.stringify([url, expires]));
    return `${payload}.${this.mac(payload)}`;
  }

  /** The URL a token names, or undefined when it is forged or expired. */
  verify(token: string, now = Date.now()): string | undefined {
    const [payload, mac, ...rest] = String(token).split(".");
    if (!payload || !mac || rest.length) return undefined;
    const expected = Buffer.from(this.mac(payload));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return undefined;
    }
    try {
      const [url, expires] = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as [unknown, unknown];
      if (typeof url !== "string" || typeof expires !== "number") {
        return undefined;
      }
      return expires * 1000 >= now ? url : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * The HTML with its remote images pointed at the proxy, and the proxy's
   * address; the HTML as it was when the proxy is off. What this misses
   * stays a remote URL, which the frame's policy blocks.
   */
  rewrite(html: string): { html: string; imageProxy?: string } {
    const base = this.baseUrl;
    if (!base) return { html };
    const proxied = (raw: string): string | undefined => {
      const url = remote(decodeAttribute(raw));
      return url ? `${base}${this.sign(url)}` : undefined;
    };
    const out = html
      .replace(IMAGE_TAGS, (tag) =>
        tag
          .replace(IMAGE_ATTRIBUTES, (whole, name, dq, sq, bare) => {
            const to = proxied(dq ?? sq ?? bare ?? "");
            return to ? `${name}"${to}"` : whole;
          })
          .replace(SRCSET, (whole, name, dq, sq) => {
            const list = decodeAttribute(dq ?? sq ?? "");
            const rewritten = list
              .split(",")
              .map((candidate) => {
                const [url, ...descriptor] = candidate.trim().split(/\s+/);
                const to = url ? proxied(url) : undefined;
                // A width or density only: the value was decoded, and
                // anything else could close the attribute it goes back in.
                const size = descriptor.filter((d) =>
                  /^\d+(\.\d+)?[wx]$/.test(d),
                );
                return to ? [to, ...size].join(" ") : undefined;
              })
              .filter((c): c is string => Boolean(c));
            return rewritten.length ? `${name}"${rewritten.join(", ")}"` : "";
          }),
      )
      .replace(CSS_URL, (whole, _quote, url) => {
        const to = proxied(url);
        // Unquoted: the proxy's URL has no character CSS would need quoted,
        // and a quote could end the style attribute it sits in.
        return to ? `url(${to})` : whole;
      })
      .replace(CSS_URL_ENTITY, (whole, _quote, url) => {
        const to = proxied(url);
        return to ? `url(${to})` : whole;
      });
    return { html: out, imageProxy: base };
  }

  private mac(payload: string): string {
    return createHmac("sha256", this.key).update(payload).digest("base64url");
  }
}
