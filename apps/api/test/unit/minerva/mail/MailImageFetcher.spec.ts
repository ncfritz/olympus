import * as http from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkImageUrl,
  isPublicAddress,
  lookupAllowing,
  MailImageFetcher,
  MailImageFetchError,
  MAX_IMAGE_BYTES,
} from "../../../../src/minerva/mail/services/MailImageFetcher";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "fc00::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a00:1",
    "2002:c0a8:101::1",
    "2001:0:4136:e378::1",
    "2001:db8::1",
    "not an address",
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["93.184.215.14", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe("checkImageUrl", () => {
  it.each([
    ["file:///etc/passwd", /file:/],
    ["ftp://example.test/a.png", /ftp:/],
    ["https://user:pass@example.test/a.png", /credentials/],
    ["https://example.test:8080/a.png", /port 8080/],
    ["http://127.0.0.1/a.png", /public internet/],
    ["http://[::1]/a.png", /public internet/],
    ["http://169.254.169.254/latest/meta-data", /public internet/],
    ["http://hasura/v1/graphql", /not a public name/],
    ["not a url", /Not a URL/],
  ])("refuses %s", (url, reason) => {
    expect(() => checkImageUrl(url)).toThrow(reason);
  });

  it("allows a public name on the usual ports", () => {
    expect(checkImageUrl("https://cdn.example.test/a.png").hostname).toBe(
      "cdn.example.test",
    );
    expect(checkImageUrl("http://93.184.215.14:80/a.png").port).toBe("");
  });
});

describe("lookupAllowing", () => {
  it("refuses a name that resolves only to addresses it does not allow", async () => {
    const lookup = lookupAllowing(isPublicAddress);
    const error = await new Promise<Error | null>((resolve) =>
      lookup("localhost", { all: true }, (e) => resolve(e)),
    );
    expect(error).toBeInstanceOf(MailImageFetchError);
  });
});

/** The fetcher against a server of the tests' own on 127.0.0.1. */
class LocalFetcher extends MailImageFetcher {
  constructor(timeoutMs = 2_000) {
    super();
    this.allowed = (a) => a === "127.0.0.1";
    this.anyPort = true;
    this.timeoutMs = timeoutMs;
  }
}

describe("MailImageFetcher", () => {
  let server: http.Server;
  let base: string;
  const routes: Record<string, (res: http.ServerResponse) => void> = {
    "/pixel.png": (res) =>
      res.writeHead(200, { "Content-Type": "image/png" }).end(PNG),
    "/pixel.jpg": (res) =>
      res
        .writeHead(200, { "Content-Type": "image/jpg; charset=binary" })
        .end(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(20).fill(0)])),
    "/page": (res) =>
      res.writeHead(200, { "Content-Type": "text/html" }).end("<html></html>"),
    "/vector.svg": (res) =>
      res
        .writeHead(200, { "Content-Type": "image/svg+xml" })
        .end("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"),
    "/liar.png": (res) =>
      res
        .writeHead(200, { "Content-Type": "image/png" })
        .end("<html>not a png</html>"),
    "/huge.png": (res) => {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]));
    },
    "/slow.png": (res) => {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.write(PNG.subarray(0, 8));
      // Never ends.
    },
    "/to-pixel": (res) => res.writeHead(302, { Location: "/pixel.png" }).end(),
    "/to-lan": (res) =>
      res.writeHead(302, { Location: "http://10.0.0.1/pixel.png" }).end(),
    "/loop": (res) => res.writeHead(302, { Location: "/loop" }).end(),
    "/missing.png": (res) => res.writeHead(404).end(),
  };

  beforeAll(async () => {
    server = http.createServer((req, res) =>
      (routes[req.url ?? ""] ?? routes["/missing.png"])(res),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it("fetches an image, its bytes bearing out its type", async () => {
    const image = await new LocalFetcher().fetch(`${base}/pixel.png`);
    expect(image.contentType).toBe("image/png");
    expect(image.body.equals(PNG)).toBe(true);
    const jpeg = await new LocalFetcher().fetch(`${base}/pixel.jpg`);
    expect(jpeg.contentType).toBe("image/jpeg");
  });

  it("follows a redirect, checking where it goes", async () => {
    expect(
      (await new LocalFetcher().fetch(`${base}/to-pixel`)).body.equals(PNG),
    ).toBe(true);
    await expect(new LocalFetcher().fetch(`${base}/to-lan`)).rejects.toThrow(
      /public internet/,
    );
    await expect(new LocalFetcher().fetch(`${base}/loop`)).rejects.toThrow(
      /redirects/,
    );
  });

  it.each([
    ["/page", /Not an image/],
    ["/vector.svg", /Not an image/],
    ["/liar.png", /Not an image/],
    ["/huge.png", /Too large/],
    ["/missing.png", /404/],
  ])("refuses %s", async (path, reason) => {
    await expect(new LocalFetcher().fetch(`${base}${path}`)).rejects.toThrow(
      reason,
    );
  });

  it("gives up on an image that takes too long", async () => {
    await expect(
      new LocalFetcher(300).fetch(`${base}/slow.png`),
    ).rejects.toThrow(/Timed out/);
  });

  it("will not fetch from this host by default", async () => {
    await expect(
      new MailImageFetcher().fetch(`${base}/pixel.png`),
    ).rejects.toThrow(MailImageFetchError);
  });
});

describe("MailImageFetcher's turns", () => {
  it("fetches at most MAX_CONCURRENT_FETCHES at once", async () => {
    const { MAX_CONCURRENT_FETCHES } =
      await import("../../../../src/minerva/mail/services/MailImageFetcher");
    let running = 0;
    let most = 0;
    class Counting extends MailImageFetcher {
      // The network replaced: each fetch takes a moment.
      protected override async fetchNow() {
        running++;
        most = Math.max(most, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        return { contentType: "image/png", body: PNG };
      }
    }
    const fetcher = new Counting();
    await Promise.all(
      Array.from({ length: 30 }, () =>
        fetcher.fetch("https://cdn.example.test/a.png"),
      ),
    );
    expect(most).toBe(MAX_CONCURRENT_FETCHES);
  });
});
