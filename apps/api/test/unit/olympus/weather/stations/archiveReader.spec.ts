import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdCompressSync } from "node:zlib";
import moment from "moment";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseDay,
  readArchive,
} from "../../../../../src/olympus/weather/stations/archiveReader";

const A = "A0-B1-C2-D3-E4-F5";
const B = "0A-1B-2C-3D-4E-5F";

describe("readArchive", () => {
  let dir: string;

  const line = (query: string) =>
    JSON.stringify({
      receivedAt: "2026-09-29T00:00:00Z",
      source: "push",
      query,
    }) + "\n";

  const write = (
    station: string,
    day: string,
    text: string,
    sealed = false,
  ) => {
    const [yyyy, mm, dd] = day.split("-");
    const month = join(dir, station, yyyy, mm);
    mkdirSync(month, { recursive: true });
    if (sealed) {
      writeFileSync(join(month, `${dd}.jsonl.zst`), zstdCompressSync(text));
      writeFileSync(join(month, `${dd}.jsonl.zst.sha256`), "x  y\n");
    } else {
      writeFileSync(join(month, `${dd}.jsonl`), text);
    }
  };

  const read = async (from: string, to: string, macAddress?: string) => {
    const days = [];
    for await (const day of readArchive(dir, {
      from: moment.utc(from),
      to: moment.utc(to),
      macAddress,
    })) {
      days.push(day);
    }
    return days;
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "weather-archive-read-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads sealed and open days, a day at a time for every station", async () => {
    write(A, "2026-09-28", line("&a=1") + line("&a=2"), true);
    write(B, "2026-09-28", line("&b=1"), true);
    write(A, "2026-09-29", line("&a=3"));

    const days = await read("2026-09-28", "2026-09-29");

    expect(days.map((d) => `${d.day} ${d.macAddress}`)).toEqual([
      "2026-09-28 0A:1B:2C:3D:4E:5F",
      "2026-09-28 A0:B1:C2:D3:E4:F5",
      "2026-09-29 A0:B1:C2:D3:E4:F5",
    ]);
    expect(days[1].lines.map((l) => l.query)).toEqual(["&a=1", "&a=2"]);
    expect(days[2].lines.map((l) => l.query)).toEqual(["&a=3"]);
  });

  it("keeps to the range and the station asked for", async () => {
    write(A, "2026-09-27", line("&old=1"));
    write(A, "2026-09-28", line("&a=1"));
    write(B, "2026-09-28", line("&b=1"));
    write(A, "2026-09-30", line("&new=1"));

    const days = await read("2026-09-28", "2026-09-29", "A0:B1:C2:D3:E4:F5");

    expect(days.map((d) => d.day)).toEqual(["2026-09-28"]);
    expect(days[0].macAddress).toBe("A0:B1:C2:D3:E4:F5");
  });

  it("reads the plain file while a seal has not finished", async () => {
    const [yyyy, mm] = ["2026", "09"];
    const month = join(dir, A, yyyy, mm);
    mkdirSync(month, { recursive: true });
    writeFileSync(join(month, "28.jsonl"), line("&plain=1"));
    // Compressed but not yet checksummed: not finished.
    writeFileSync(join(month, "28.jsonl.zst"), zstdCompressSync("garbage"));

    const [day] = await read("2026-09-28", "2026-09-28");
    expect(day.file.endsWith("28.jsonl")).toBe(true);
    expect(day.lines[0].query).toBe("&plain=1");
  });

  it("counts lines that are not archive lines, and carries on", async () => {
    write(
      A,
      "2026-09-28",
      line("&a=1") + "not json\n" + '{"source":"push"}\n' + "\n" + line("&a=2"),
    );
    const [day] = await read("2026-09-28", "2026-09-28");
    expect(day.lines).toHaveLength(2);
    expect(day.unreadable).toBe(2);
  });

  it("ignores directories that are not stations, and a missing archive", async () => {
    mkdirSync(join(dir, "lost+found"));
    write(A, "2026-09-28", line("&a=1"));
    expect(await read("2026-09-28", "2026-09-28")).toHaveLength(1);

    rmSync(dir, { recursive: true, force: true });
    expect(await read("2026-09-28", "2026-09-28")).toEqual([]);
  });
});

describe("parseDay", () => {
  it("reads a UTC day", () => {
    expect(parseDay("2026-09-29")?.toISOString()).toBe(
      "2026-09-29T00:00:00.000Z",
    );
  });

  it.each([
    ["2026-9-29"],
    ["2026-02-30"],
    ["yesterday"],
    [20260929],
    [undefined],
  ])("refuses %s", (value) => {
    expect(parseDay(value)).toBeUndefined();
  });
});
