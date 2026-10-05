import { describe, expect, it } from "vitest";
import {
  MboxEntry,
  MboxReader,
} from "../../../../src/sources/takeout/MboxReader";
import { mbox, message, writeMbox } from "../../../support/mbox";

const all = async (path: string, offset = 0, chunk?: number) => {
  const entries: MboxEntry[] = [];
  for await (const e of new MboxReader(chunk).read(path, offset)) {
    entries.push(e);
  }
  return entries;
};

describe("MboxReader", () => {
  const content = mbox(
    message({ id: "100", body: "First.\n" }),
    // A body line starting "From " after a blank line is not a separator.
    message({ id: "200", body: "Line.\n\nFrom the archive, a quote.\n" }),
    message({ id: "300", body: "Last.\n" }),
  );

  it("splits on Takeout's separators only", async () => {
    const entries = await all(writeMbox(content));
    expect(entries.map((e) => e.decimalId)).toEqual(["100", "200", "300"]);
    expect(entries[1].raw.toString()).toContain("From the archive, a quote.");
    expect(entries[0].separatorDate).toBe("Fri Oct 02 03:46:59 +0000 2026");
  });

  it("leaves the separator and the blank line after out of the message", async () => {
    const [first] = await all(writeMbox(content));
    const raw = first.raw.toString();
    expect(raw.startsWith("X-GM-THRID:")).toBe(true);
    expect(raw.endsWith("First.\n")).toBe(true);
  });

  it("gives each message's offset, and resumes from one", async () => {
    const path = writeMbox(content);
    const entries = await all(path);
    expect(entries[0].offset).toBe(0);
    expect(content.slice(entries[2].offset).startsWith("From 300@xxx")).toBe(
      true,
    );
    const resumed = await all(path, entries[1].offset);
    expect(resumed.map((e) => e.decimalId)).toEqual(["200", "300"]);
    expect(resumed[0].offset).toBe(entries[1].offset);
  });

  it("reads the same across chunk boundaries", async () => {
    const path = writeMbox(content);
    const whole = await all(path);
    const tiny = await all(path, 0, 7);
    expect(tiny.map((e) => [e.offset, e.raw.toString()])).toEqual(
      whole.map((e) => [e.offset, e.raw.toString()]),
    );
  });

  it("handles CRLF line ends and a file without a final newline", async () => {
    const crlf = mbox(message({ id: "1" }), message({ id: "2" }))
      .replace(/\n/g, "\r\n")
      .replace(/\r\n$/, "");
    const entries = await all(writeMbox(crlf));
    expect(entries.map((e) => e.decimalId)).toEqual(["1", "2"]);
  });

  it("keeps bytes as they are, for the MIME parser to decode", async () => {
    const latin1 = Buffer.concat([
      Buffer.from(message({ id: "7", body: "" })),
      Buffer.from([0xe9, 0x0a]),
    ]);
    const [entry] = await all(writeMbox(latin1));
    expect(entry.raw.includes(Buffer.from([0xe9]))).toBe(true);
  });
});
