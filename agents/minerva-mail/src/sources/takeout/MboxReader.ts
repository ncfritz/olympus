import { createReadStream } from "fs";

/** One message of a Takeout mbox, as bytes. */
export type MboxEntry = {
  /** The byte offset of its separator line: where a resumed read starts. */
  offset: number;
  /** Gmail's message ID, decimal, from the separator. */
  decimalId: string;
  /** The separator's date as written: `Fri Oct 02 03:46:59 +0000 2026`. */
  separatorDate: string;
  /** Headers and body, without the separator line or the blank line after. */
  raw: Buffer;
};

/**
 * Takeout's separator: `From <decimal message ID>@xxx <date>`, after a blank
 * line or at the start. Body lines starting `From ` never match it.
 */
const SEPARATOR = /^From (\d+)@xxx (.+?)\r?\n?$/;
const FROM_ = Buffer.from("From ");

const isBlank = (line: Buffer) =>
  line.length === 0 ||
  (line.length === 1 && line[0] === 0x0a) ||
  (line.length === 2 && line[0] === 0x0d && line[1] === 0x0a);

/**
 * Streams a Takeout mbox message by message, from a byte offset, without
 * holding more than one message in memory. The archive is only read.
 */
export class MboxReader {
  constructor(private readonly chunkBytes = 1 << 20) {}

  async *read(path: string, startOffset = 0): AsyncGenerator<MboxEntry> {
    const stream = createReadStream(path, {
      start: startOffset,
      highWaterMark: this.chunkBytes,
    });
    let carry = Buffer.alloc(0);
    // The file offset of the first byte of `carry`, then of each chunk.
    let position = startOffset;
    let previousBlank = true;
    let current:
      | { offset: number; decimalId: string; date: string; parts: Buffer[] }
      | undefined;

    const finish = (): MboxEntry | undefined => {
      if (!current) return undefined;
      const parts = current.parts;
      // The blank line before the next separator belongs to the mbox.
      if (parts.length && isBlank(parts[parts.length - 1])) parts.pop();
      return {
        offset: current.offset,
        decimalId: current.decimalId,
        separatorDate: current.date,
        raw: Buffer.concat(parts),
      };
    };

    for await (const chunk of stream as AsyncIterable<Buffer>) {
      const buffer = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      let start = 0;
      let newline: number;
      while ((newline = buffer.indexOf(0x0a, start)) !== -1) {
        const line = buffer.subarray(start, newline + 1);
        const lineOffset = position + start;
        start = newline + 1;
        if (previousBlank && line.subarray(0, 5).equals(FROM_)) {
          const match = SEPARATOR.exec(line.toString("latin1"));
          if (match) {
            const done = finish();
            if (done) yield done;
            current = {
              offset: lineOffset,
              decimalId: match[1],
              date: match[2],
              parts: [],
            };
            previousBlank = false;
            continue;
          }
        }
        current?.parts.push(line);
        previousBlank = isBlank(line);
      }
      // Copied, so the chunk it came from can be released.
      carry = Buffer.from(buffer.subarray(start));
      position += start;
    }
    if (carry.length) current?.parts.push(carry);
    const last = finish();
    if (last) yield last;
  }
}
