import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { sha256File } from "../../../src/tools/sha256";

describe("sha256File", () => {
  it("hashes a file", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sha-"));
    fs.writeFileSync(`${dir}/a.txt`, "abc");
    try {
      expect(await sha256File(`${dir}/a.txt`)).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects when the file can't be read", async () => {
    await expect(sha256File("/nonexistent/transcoded.mp4")).rejects.toThrow(
      /ENOENT/,
    );
  });
});
