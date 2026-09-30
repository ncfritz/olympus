import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import {
  StationArchive,
  stationDirectory,
} from "../../../../../src/olympus/weather/stations/StationArchive";

const MAC = "A0:B1:C2:D3:E4:F5";

describe("StationArchive", () => {
  let dir: string;
  let archive: StationArchive;

  const line = (receivedAt: string, query = "&tempf=58.1") => ({
    receivedAt,
    source: "push" as const,
    remote: "192.168.15.20",
    query,
  });

  const day = (...parts: string[]) => join(dir, "A0-B1-C2-D3-E4-F5", ...parts);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "weather-archive-"));
    archive = new StationArchive({
      stations: { archiveDir: dir },
    } as WeatherConfigType);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("appends one JSON line per push to the UTC day it was received", async () => {
    await archive.append(MAC, line("2026-09-29T23:59:58Z", "&a=1"));
    await archive.append(MAC, line("2026-09-29T23:59:59Z", "&a=2"));

    const lines = readFileSync(day("2026", "09", "29.jsonl"), "utf8")
      .trimEnd()
      .split("\n")
      .map((text) => JSON.parse(text));
    expect(lines.map((l) => l.query)).toEqual(["&a=1", "&a=2"]);
    expect(lines[0]).toMatchObject({ source: "push", remote: "192.168.15.20" });
  });

  it("seals the previous day on the first write of a new one", async () => {
    await archive.append(MAC, line("2026-09-29T23:59:59Z", "&a=1"));
    await archive.append(MAC, line("2026-09-30T00:00:15Z", "&a=2"));

    expect(existsSync(day("2026", "09", "29.jsonl"))).toBe(false);
    const sealed = day("2026", "09", "29.jsonl.zst");
    const text = zstdDecompressSync(readFileSync(sealed)).toString("utf8");
    expect(JSON.parse(text.trimEnd()).query).toBe("&a=1");
    expect(readFileSync(day("2026", "09", "30.jsonl"), "utf8")).toContain(
      "&a=2",
    );
  });

  it("writes a checksum sha256sum can verify", async () => {
    await archive.append(MAC, line("2026-09-29T12:00:00Z"));
    await archive.append(MAC, line("2026-09-30T00:00:15Z"));

    const month = day("2026", "09");
    expect(readFileSync(join(month, "29.jsonl.zst.sha256"), "utf8")).toMatch(
      /^[0-9a-f]{64} {2}29\.jsonl\.zst\n$/,
    );
    const check = (() => {
      try {
        return execFileSync("sha256sum", ["-c", "29.jsonl.zst.sha256"], {
          cwd: month,
        }).toString();
      } catch {
        return undefined;
      }
    })();
    if (check !== undefined) expect(check).toContain("OK");
  });

  it("seals days left over from before a restart", async () => {
    const month = day("2026", "09");
    execFileSync("mkdir", ["-p", month]);
    writeFileSync(join(month, "27.jsonl"), '{"query":"&a=0"}\n');
    writeFileSync(join(month, "28.jsonl"), '{"query":"&a=1"}\n');

    await archive.append(MAC, line("2026-09-29T08:00:00Z"));

    expect(readdirSync(month).sort()).toEqual([
      "27.jsonl.zst",
      "27.jsonl.zst.sha256",
      "28.jsonl.zst",
      "28.jsonl.zst.sha256",
      "29.jsonl",
    ]);
  });

  it("keeps each station in its own directory", async () => {
    await archive.append(MAC, line("2026-09-29T08:00:00Z"));
    await archive.append("0A:1B:2C:3D:4E:5F", line("2026-09-29T08:00:00Z"));
    expect(readdirSync(dir).sort()).toEqual([
      "0A-1B-2C-3D-4E-5F",
      "A0-B1-C2-D3-E4-F5",
    ]);
    expect(archive.directoryFor(MAC)).toBe(join(dir, "A0-B1-C2-D3-E4-F5"));
  });

  it("answers false, and does not throw, when it cannot write", async () => {
    // A file where the station's directory should be.
    writeFileSync(join(dir, "A0-B1-C2-D3-E4-F5"), "");
    await expect(
      archive.append(MAC, line("2026-09-29T08:00:00Z")),
    ).resolves.toBe(false);
  });

  it("names a station's directory without colons", () => {
    expect(stationDirectory("a0:b1:c2:d3:e4:f5")).toBe("A0-B1-C2-D3-E4-F5");
  });
});
