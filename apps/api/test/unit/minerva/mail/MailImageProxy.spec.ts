import { describe, expect, it } from "vitest";
import type { AuthConfigType } from "../../../../src/config/configuration";
import {
  IMAGE_TOKEN_TTL_SECONDS,
  MailImageProxy,
} from "../../../../src/minerva/mail/services/MailImageProxy";

const BASE = "https://olympus.example.test/api";
const PROXY = "https://olympus.example.test/api/v1/minerva/mail/image/";

const proxy = (publicBaseUrl: string | undefined = BASE) =>
  new MailImageProxy({ users: { publicBaseUrl } } as unknown as AuthConfigType);

/** The URL each proxied image in the HTML names, in order. */
const named = (p: MailImageProxy, html: string) =>
  [...html.matchAll(/image\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g)].map((m) =>
    p.verify(m[1]),
  );

describe("MailImageProxy tokens", () => {
  it("name one URL, and only this API's signature passes", () => {
    const p = proxy();
    const token = p.sign("https://cdn.example.test/a.png?x=1&y=2");
    expect(p.verify(token)).toBe("https://cdn.example.test/a.png?x=1&y=2");
    // Another process's key, and a token changed in transit.
    expect(proxy().verify(token)).toBeUndefined();
    const [payload, mac] = token.split(".");
    const other = Buffer.from(
      JSON.stringify(["http://10.0.0.1/", Date.now() / 1000 + 60]),
    ).toString("base64url");
    expect(p.verify(`${other}.${mac}`)).toBeUndefined();
    expect(p.verify(`${payload}.${mac}x`)).toBeUndefined();
    expect(p.verify(`${payload}`)).toBeUndefined();
    expect(p.verify("")).toBeUndefined();
  });

  it("expire", () => {
    const p = proxy();
    const now = Date.parse("2026-10-09T12:00:00Z");
    const token = p.sign("https://cdn.example.test/a.png", now);
    expect(p.verify(token, now + IMAGE_TOKEN_TTL_SECONDS * 1000)).toBeDefined();
    expect(
      p.verify(token, now + IMAGE_TOKEN_TTL_SECONDS * 1000 + 1000),
    ).toBeUndefined();
  });
});

describe("MailImageProxy.rewrite", () => {
  it("points an image's remote URLs at the proxy, however they are written", () => {
    const p = proxy();
    const html = [
      '<img src="https://cdn.example.test/a.png?x=1&amp;y=2">',
      "<img alt=x src='http://cdn.example.test/b.gif'>",
      "<img src=//cdn.example.test/c.jpg>",
      '<td background="https://cdn.example.test/d.png">',
      '<img srcset="https://cdn.example.test/e.png 1x, https://cdn.example.test/e2.png 2x">',
    ].join("");
    const { html: out, imageProxy } = p.rewrite(html);
    expect(imageProxy).toBe(PROXY);
    expect(out).not.toContain("cdn.example.test");
    expect(named(p, out)).toEqual([
      "https://cdn.example.test/a.png?x=1&y=2",
      "http://cdn.example.test/b.gif",
      "https://cdn.example.test/c.jpg",
      "https://cdn.example.test/d.png",
      "https://cdn.example.test/e.png",
      "https://cdn.example.test/e2.png",
    ]);
    expect(out).toMatch(/ 2x"/);
  });

  it("points CSS's url() at it too, in a style attribute or element", () => {
    const p = proxy();
    const html =
      `<div style="background:url('https://cdn.example.test/f.png')"></div>` +
      `<div style="background-image:url(&quot;https://cdn.example.test/g.png?a=1&amp;b=2&quot;)"></div>` +
      "<style>.h{background:url(https://cdn.example.test/h.png)}</style>";
    const { html: out } = p.rewrite(html);
    expect(out).not.toContain("cdn.example.test");
    expect(named(p, out)).toEqual([
      "https://cdn.example.test/f.png",
      "https://cdn.example.test/g.png?a=1&b=2",
      "https://cdn.example.test/h.png",
    ]);
    // Still one style attribute each: no quote put in to end it early.
    expect(out.match(/style="[^"]*"/g)).toHaveLength(2);
  });

  it("leaves what is not a remote image", () => {
    const p = proxy();
    const html =
      '<a href="https://example.test/page">link</a>' +
      '<img src="data:image/png;base64,AAAA">' +
      '<img src="cid:logo">' +
      '<iframe src="https://example.test/frame"></iframe>' +
      "<p>see url(https://example.test) in text</p>".replace("url(", "url (");
    expect(p.rewrite(html).html).toBe(html);
  });

  it("does nothing without a public address for the API", () => {
    const html = '<img src="https://cdn.example.test/a.png">';
    expect(proxy("").rewrite(html)).toEqual({ html });
  });
});

describe("MailImageProxy.rewrite and srcset", () => {
  it("keeps only a width or density, so a descriptor cannot close the attribute", () => {
    const p = proxy();
    const { html } = p.rewrite(
      `<img srcset='https://cdn.example.test/x.png 1x" onerror="alert(1)'>`,
    );
    expect(html).not.toContain("onerror");
    expect(named(p, html)).toEqual(["https://cdn.example.test/x.png"]);
  });
});
