/**
 * Images a message carries inside itself (`cid:` references to its own
 * MIME parts: logos, signatures), put into its HTML as `data:` URLs so the
 * viewer's frame, which loads nothing from outside, can show them
 * (docs/plans/email-management phase 5). Raster types only: an SVG can
 * carry script. Bounded, so a message of large photographs is not a
 * response of tens of megabytes; what is over the bound stays a `cid:`
 * reference and shows as a broken image.
 */

/** The most of one image put in, in bytes. */
export const MAX_INLINE_IMAGE_BYTES = 1_000_000;
/** The most put in altogether, in bytes, before base64. */
export const MAX_INLINE_TOTAL_BYTES = 4_000_000;

const RASTER = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/avif",
]);

/** A part as postal-mime gives it; only what is read here. */
export type InlinePart = {
  mimeType: string;
  contentId?: string;
  content: ArrayBuffer | Uint8Array | string;
};

const bytesOf = (content: InlinePart["content"]): Buffer =>
  typeof content === "string"
    ? Buffer.from(content)
    : Buffer.from(content as ArrayBuffer);

/** A Content-ID without its angle brackets, as a `cid:` URL names it. */
const idOf = (contentId: string): string =>
  contentId.trim().replace(/^</, "").replace(/>$/, "").trim();

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The HTML with each `cid:` reference to one of `parts` replaced by its
 * image, within the bounds; the count put in.
 */
export const embedInlineImages = (
  html: string,
  parts: InlinePart[],
): { html: string; embedded: number } => {
  let total = 0;
  let embedded = 0;
  let out = html;
  for (const part of parts) {
    if (!part.contentId) continue;
    const type = part.mimeType.toLowerCase();
    if (!RASTER.has(type)) continue;
    const id = idOf(part.contentId);
    if (!id) continue;
    // As written, or percent-encoded as some senders do.
    const pattern = new RegExp(
      `cid:(?:${escape(id)}|${escape(encodeURIComponent(id))})(?=["'\\s)>])`,
      "gi",
    );
    if (!pattern.test(out)) continue;
    const bytes = bytesOf(part.content);
    if (
      bytes.byteLength > MAX_INLINE_IMAGE_BYTES ||
      total + bytes.byteLength > MAX_INLINE_TOTAL_BYTES
    ) {
      continue;
    }
    total += bytes.byteLength;
    embedded++;
    const url = `data:${type === "image/jpg" ? "image/jpeg" : type};base64,${bytes.toString("base64")}`;
    pattern.lastIndex = 0;
    out = out.replace(pattern, url);
  }
  return { html: out, embedded };
};
