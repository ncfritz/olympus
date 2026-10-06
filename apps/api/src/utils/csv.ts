/**
 * CSV as RFC 4180 writes it: comma-separated, CRLF line ends, a field
 * quoted when it holds a comma, quote or line break, quotes doubled. A
 * field a spreadsheet would read as a formula (starting `=`, `+`, `-`,
 * `@`, tab or carriage return) gets a leading apostrophe, since subjects
 * and names come from strangers' mail.
 */
export const csvField = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const csvRow = (values: (string | number | null | undefined)[]) =>
  `${values.map(csvField).join(",")}\r\n`;
