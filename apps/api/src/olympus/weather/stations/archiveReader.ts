import { createReadStream, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { createZstdDecompress } from "node:zlib";
import moment, { type Moment } from "moment";
import { normalizeMac } from "./ambientReport";
import type { ArchiveLine } from "./StationArchive";

/** One station's lines for one UTC day, as the archive holds them. */
export type ArchiveDay = {
  macAddress: string;
  /** The UTC day, `YYYY-MM-DD`. */
  day: string;
  file: string;
  lines: ArchiveLine[];
  /** Lines that were not JSON, or not an archive line. */
  unreadable: number;
};

export type ArchiveRange = {
  /** First UTC day, inclusive. */
  from: Moment;
  /** Last UTC day, inclusive. */
  to: Moment;
  /** Only this station; every station when absent. */
  macAddress?: string;
};

/**
 * The archive's days in a range, oldest first and every station's day
 * before the next day (StationArchive's layout:
 * `<dir>/<MAC-with-dashes>/<yyyy>/<mm>/<dd>.jsonl[.zst]`).
 *
 * A sealed day is read from its `.zst` once its checksum file exists (the
 * seal is finished); otherwise from the plain file, which is a day still
 * being written or one whose seal was interrupted. `dir` may be the API's
 * own archive, prod's on the Mac Mini, or a copy from the NAS.
 */
export async function* readArchive(
  dir: string,
  range: ArchiveRange,
): AsyncGenerator<ArchiveDay> {
  const stations = (await names(dir))
    .map((name) => ({ name, macAddress: normalizeMac(name) }))
    .filter(
      (station): station is { name: string; macAddress: string } =>
        station.macAddress !== undefined &&
        (range.macAddress === undefined ||
          station.macAddress === range.macAddress),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const day = range.from.clone().utc().startOf("day");
  const last = range.to.clone().utc().startOf("day");
  for (; !day.isAfter(last); day.add(1, "day")) {
    for (const station of stations) {
      const base = join(
        dir,
        station.name,
        day.format("YYYY"),
        day.format("MM"),
        `${day.format("DD")}.jsonl`,
      );
      const sealed = `${base}.zst`;
      const file = existsSync(`${sealed}.sha256`)
        ? sealed
        : existsSync(base)
          ? base
          : undefined;
      if (!file) continue;
      yield {
        macAddress: station.macAddress,
        day: day.format("YYYY-MM-DD"),
        file,
        ...(await readLines(file)),
      };
    }
  }
}

const readLines = async (
  file: string,
): Promise<{ lines: ArchiveLine[]; unreadable: number }> => {
  const raw = createReadStream(file);
  const stream: Readable = file.endsWith(".zst")
    ? raw.pipe(createZstdDecompress())
    : raw;
  const lines: ArchiveLine[] = [];
  let unreadable = 0;
  for await (const text of createInterface({
    input: stream,
    crlfDelay: Infinity,
  })) {
    if (text.trim() === "") continue;
    const line = parseLine(text);
    if (line) lines.push(line);
    else unreadable += 1;
  }
  return { lines, unreadable };
};

const parseLine = (text: string): ArchiveLine | undefined => {
  try {
    const value = JSON.parse(text) as Partial<ArchiveLine> | null;
    if (
      value &&
      typeof value.receivedAt === "string" &&
      (value.source === "push" || value.source === "backfill")
    ) {
      return value as ArchiveLine;
    }
  } catch {
    // Counted below.
  }
  return undefined;
};

/** The UTC day a `YYYY-MM-DD` names, or undefined. */
export const parseDay = (value: unknown): Moment | undefined => {
  if (typeof value !== "string") return undefined;
  const parsed = moment.utc(value, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed : undefined;
};

const names = async (directory: string): Promise<string[]> => {
  try {
    return await readdir(directory);
  } catch {
    return [];
  }
};
