/*
 * A message body as plain text, for the classifier (in memory only), and
 * the snippet kept from it (ADR 0030).
 */

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

const decodeEntity = (entity: string): string => {
  const named = ENTITIES[entity.toLowerCase()];
  if (named !== undefined) return named;
  const code = /^#x([0-9a-f]+)$/i.exec(entity)
    ? parseInt(entity.slice(2), 16)
    : /^#(\d+)$/.test(entity)
      ? parseInt(entity.slice(1), 10)
      : NaN;
  if (Number.isInteger(code) && code > 0 && code <= 0x10ffff) {
    return String.fromCodePoint(code);
  }
  return `&${entity};`;
};

/** HTML to text, well enough to featurize: tags dropped, blocks as lines. */
export const htmlToText = (html: string): string =>
  html
    .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/table)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-z]+|#\d+|#x[0-9a-f]+);/gi, (_, entity: string) =>
      decodeEntity(entity),
    )
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

export const SNIPPET_LENGTH = 200;

/** The first 200 characters of the text, whitespace collapsed. */
export const snippetOf = (text: string): string => {
  const collapsed = text
    .slice(0, SNIPPET_LENGTH * 4)
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(collapsed).slice(0, SNIPPET_LENGTH).join("");
};
