import { describe, expect, it } from "vitest";
import {
  embedInlineImages,
  MAX_INLINE_IMAGE_BYTES,
  MAX_INLINE_TOTAL_BYTES,
} from "../../../src/sources/inlineImages";

const png = (bytes = 8) => new Uint8Array(bytes).fill(1);
const b64 = (bytes = 8) => Buffer.from(png(bytes)).toString("base64");

describe("embedInlineImages", () => {
  it("puts a message's own image in as a data URL, wherever it is named", () => {
    const html =
      '<img src="cid:logo@example.test"><div style="background:url(cid:logo@example.test)"></div><img src=cid:logo@example.test>';
    const { html: out, embedded } = embedInlineImages(html, [
      {
        mimeType: "image/PNG",
        contentId: "<logo@example.test>",
        content: png(),
      },
    ]);
    expect(embedded).toBe(1);
    expect(out).not.toContain("cid:");
    expect(out.split(`data:image/png;base64,${b64()}`)).toHaveLength(4);
  });

  it("matches an ID the sender percent-encoded", () => {
    const { html } = embedInlineImages('<img src="cid:a%20b">', [
      { mimeType: "image/gif", contentId: "<a b>", content: png() },
    ]);
    expect(html).toBe(`<img src="data:image/gif;base64,${b64()}">`);
  });

  it("leaves what it should not put in", () => {
    const html =
      '<img src="cid:vector"><img src="cid:big"><img src="cid:unnamed"><img src="cid:other">';
    const { html: out, embedded } = embedInlineImages(html, [
      // An SVG can carry script.
      { mimeType: "image/svg+xml", contentId: "<vector>", content: png() },
      {
        mimeType: "image/png",
        contentId: "<big>",
        content: png(MAX_INLINE_IMAGE_BYTES + 1),
      },
      { mimeType: "image/png", content: png() },
      // Named nowhere in the HTML.
      { mimeType: "image/png", contentId: "<unused>", content: png() },
    ]);
    expect(embedded).toBe(0);
    expect(out).toBe(html);
  });

  it("stops at the total, and does not match a longer ID", () => {
    const each = Math.floor(MAX_INLINE_TOTAL_BYTES / 2) - 1;
    const html =
      '<img src="cid:a"><img src="cid:b"><img src="cid:c"><img src="cid:ab">';
    const { html: out, embedded } = embedInlineImages(
      html,
      ["a", "b", "c"].map((id) => ({
        mimeType: "image/jpeg",
        contentId: `<${id}>`,
        content: png(Math.min(each, MAX_INLINE_IMAGE_BYTES)),
      })),
    );
    const fitting = Math.floor(
      MAX_INLINE_TOTAL_BYTES / Math.min(each, MAX_INLINE_IMAGE_BYTES),
    );
    expect(embedded).toBe(Math.min(3, fitting));
    expect(out).toContain('src="cid:ab"');
  });
});
