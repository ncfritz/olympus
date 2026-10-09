import { Injectable } from "@nestjs/common";
import * as dns from "dns";
import * as http from "http";
import * as https from "https";
import * as net from "net";

/** The most of one image fetched, in bytes. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/**
 * Images fetched at once, the rest waiting their turn: a message of
 * hundreds of large images, or one token asked for over and over, is not
 * hundreds of buffers at once.
 */
export const MAX_CONCURRENT_FETCHES = 8;
/** How long one image may take, redirects included. */
export const IMAGE_TIMEOUT_MS = 10_000;
/** Redirects followed, each checked as the first request was. */
export const MAX_REDIRECTS = 3;

/** Why an image was not fetched: said in the log, never to the frame. */
export class MailImageFetchError extends Error {}

/**
 * Raster types only, each with the bytes it starts with: an SVG can carry
 * script, and a type the body does not bear out is refused rather than
 * passed on.
 */
const TYPES: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) =>
    b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b.subarray(0, 4).toString("latin1") === "GIF8",
  "image/webp": (b) =>
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP",
  "image/avif": (b) =>
    b.subarray(4, 12).toString("latin1").startsWith("ftypavi"),
  "image/bmp": (b) => b.subarray(0, 2).toString("latin1") === "BM",
  "image/x-icon": (b) => b.readUInt32BE(0) === 0x00000100,
};
const ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/vnd.microsoft.icon": "image/x-icon",
};

/**
 * Where the API may not be sent: this host, the LAN, the Docker networks
 * and every other range that is not the public internet (RFC 6890). An
 * IPv6 address must be global unicast (2000::/3) as well, which leaves
 * out IPv4-mapped addresses (::ffff:0:0/96; not listed here, because a
 * BlockList takes that range for all of IPv4), and the ranges that carry
 * an IPv4 address inside one (NAT64, 6to4, Teredo) are refused whole, so
 * a private IPv4 address cannot come back in that way.
 */
const BLOCKED = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const) {
  BLOCKED.addSubnet(address, prefix, "ipv6");
}
const GLOBAL_UNICAST = new net.BlockList();
GLOBAL_UNICAST.addSubnet("2000::", 3, "ipv6");

/** Whether an address is on the public internet. */
export const isPublicAddress = (address: string): boolean => {
  const family = net.isIP(address);
  if (family === 4) return !BLOCKED.check(address, "ipv4");
  if (family === 6) {
    return (
      GLOBAL_UNICAST.check(address, "ipv6") && !BLOCKED.check(address, "ipv6")
    );
  }
  return false;
};

/**
 * The resolver every request is made with: the name's addresses, those
 * `allowed` refuses dropped, an error when none is left. The connection is
 * made to an address checked here, so a name cannot answer one address
 * to a check and another to the connection.
 */
export const lookupAllowing =
  (allowed: (address: string) => boolean): net.LookupFunction =>
  (hostname, options, callback) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (error, found) => {
      if (error) return callback(error, "", 4);
      const usable = found.filter((a) => allowed(a.address));
      if (usable.length === 0) {
        return callback(
          new MailImageFetchError(`${hostname} is not on the public internet`),
          "",
          4,
        );
      }
      if ((options as dns.LookupAllOptions).all) {
        (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(
          null,
          usable,
        );
      } else {
        callback(null, usable[0].address, usable[0].family);
      }
    });
  };

/** A URL the API may fetch: http(s), on its usual port, named or public. */
export const checkImageUrl = (
  value: string,
  allowed: (address: string) => boolean = isPublicAddress,
  anyPort = false,
): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MailImageFetchError("Not a URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new MailImageFetchError(`Not fetched over ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new MailImageFetchError("A URL with credentials");
  }
  // Only the usual ports: another one on a public host is a service, not
  // an image server.
  if (!anyPort && url.port && url.port !== "80" && url.port !== "443") {
    throw new MailImageFetchError(`Not fetched on port ${url.port}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A literal address is not looked up, so it is checked here.
  if (net.isIP(host) && !allowed(host)) {
    throw new MailImageFetchError(`${host} is not on the public internet`);
  }
  if (!net.isIP(host) && !host.includes(".")) {
    throw new MailImageFetchError(`${host} is not a public name`);
  }
  return url;
};

export type FetchedImage = { contentType: string; body: Buffer };

type Response = {
  status: number;
  location?: string;
  contentType?: string;
  body?: Buffer;
};

/**
 * Remote images in mail, fetched by the API for the message viewer
 * (docs/plans/email-management phase 5): the browser never reaches the
 * sender's servers, so they see no cookies, referrer or browser of
 * Neil's, only that the API asked. Only public addresses, on the usual
 * ports, raster images only, at most MAX_IMAGE_BYTES in IMAGE_TIMEOUT_MS,
 * each redirect checked as the first request was.
 */
@Injectable()
export class MailImageFetcher {
  /** Which addresses may be fetched from; the tests' own server is not public. */
  protected allowed: (address: string) => boolean = isPublicAddress;
  protected timeoutMs = IMAGE_TIMEOUT_MS;
  /** Only the tests' server listens elsewhere than 80 and 443. */
  protected anyPort = false;
  private readonly lookup = lookupAllowing((a) => this.allowed(a));

  private running = 0;
  private readonly waiting: (() => void)[] = [];

  /** The image, fetched in its turn (MAX_CONCURRENT_FETCHES at once). */
  async fetch(value: string): Promise<FetchedImage> {
    if (this.running >= MAX_CONCURRENT_FETCHES) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running++;
    try {
      return await this.fetchNow(value);
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }

  protected async fetchNow(value: string): Promise<FetchedImage> {
    const deadline = Date.now() + this.timeoutMs;
    let url = checkImageUrl(value, this.allowed, this.anyPort);
    for (let redirects = 0; ; redirects++) {
      const response = await this.get(url, deadline);
      if (response.status >= 300 && response.status < 400) {
        if (!response.location || redirects >= MAX_REDIRECTS) {
          throw new MailImageFetchError("Too many redirects");
        }
        url = checkImageUrl(
          new URL(response.location, url).href,
          this.allowed,
          this.anyPort,
        );
        continue;
      }
      if (response.status !== 200 || !response.body) {
        throw new MailImageFetchError(`Answered ${response.status}`);
      }
      const declared = (response.contentType ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const type = ALIASES[declared] ?? declared;
      const matches = TYPES[type];
      if (!matches || response.body.length < 12 || !matches(response.body)) {
        throw new MailImageFetchError(
          `Not an image this shows (${declared || "no type"})`,
        );
      }
      return { contentType: type, body: response.body };
    }
  }

  /** One GET, the body read only for a 200, within the deadline. */
  private get(url: URL, deadline: number): Promise<Response> {
    return new Promise((resolve, reject) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        reject(new MailImageFetchError("Timed out"));
        return;
      }
      const request = (url.protocol === "https:" ? https : http).request(
        url,
        {
          method: "GET",
          lookup: this.lookup,
          // A connection each: nothing pooled across senders.
          agent: false,
          headers: {
            // A browser's, not Olympus's: some image hosts refuse others.
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
            Accept: "image/avif,image/webp,image/png,image/*;q=0.8",
          },
        },
        (response) => {
          const status = response.statusCode ?? 0;
          if (status !== 200) {
            response.resume();
            resolve({
              status,
              location: response.headers.location,
            });
            return;
          }
          const declared = Number(response.headers["content-length"]);
          if (declared > MAX_IMAGE_BYTES) {
            response.destroy();
            reject(new MailImageFetchError("Too large"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_IMAGE_BYTES) {
              response.destroy();
              reject(new MailImageFetchError("Too large"));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () =>
            resolve({
              status,
              contentType: response.headers["content-type"],
              body: Buffer.concat(chunks),
            }),
          );
          response.on("error", reject);
        },
      );
      // The whole exchange, a slow body included, not only an idle socket.
      const timer = setTimeout(
        () => request.destroy(new MailImageFetchError("Timed out")),
        remaining,
      );
      request.on("close", () => clearTimeout(timer));
      request.on("error", reject);
      request.end();
    });
  }
}
