/** A message whose RFC 822 text did not parse as MIME. */
export class MimeParseError extends Error {
  constructor(readonly causeName?: string) {
    super("The message did not parse as MIME");
  }
}
