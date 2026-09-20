import axios from "axios";
import moment from "moment";
import { Readable } from "stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gzipSync } from "zlib";
import type { JobApi } from "@ncfritz/olympus-client";
import { ExportFileSource } from "../../../src/batch/sources/ExportFileSource";
import { ListSource } from "../../../src/batch/sources/ListSource";
import { RedriveSource } from "../../../src/batch/sources/RedriveSource";

vi.mock("axios", () => ({ default: { get: vi.fn() } }));

const drain = async <R>(source: { next(): Promise<R | undefined> }) => {
  const records: R[] = [];
  let record: R | undefined;
  while ((record = await source.next())) records.push(record);
  return records;
};

describe("ExportFileSource", () => {
  beforeEach(() => {
    const lines = [
      { id: 603, original_title: "The Matrix" },
      { id: 604, original_title: "The Matrix Reloaded" },
    ];
    vi.mocked(axios.get).mockImplementation(async () => ({
      data: Readable.from([
        gzipSync(lines.map((l) => JSON.stringify(l)).join("\n") + "\n"),
      ]),
    }));
  });

  it("downloads the day's export and reads it line by line", async () => {
    const source = new ExportFileSource("movie");
    await source.init(moment.utc("2026-09-19T12:00:00Z"));

    expect(axios.get).toHaveBeenCalledWith(
      "https://files.tmdb.org/p/exports/movie_ids_09_19_2026.json.gz",
      { responseType: "stream" },
    );
    expect(source.count()).toBe(2);
    expect((await drain(source)).map((line) => line.id)).toEqual([603, 604]);
    await source.cleanup();
  });
});

describe("ListSource", () => {
  it("serves the loaded records", async () => {
    const source = new ListSource(async () => ["a", "b"]);
    await source.init();
    expect(source.count()).toBe(2);
    expect(await drain(source)).toEqual(["a", "b"]);
  });
});

describe("RedriveSource", () => {
  it("scrolls the fetch jobs a page at a time", async () => {
    const pages = [
      { jobs: [{ id: "1" }, { id: "2" }], count: 3 },
      { jobs: [{ id: "3" }], count: 3 },
      { jobs: [], count: 3 },
    ];
    const scroll = vi.fn(async () => pages.shift()!);
    const source = new RedriveSource(
      { scrollMetadataFetchJobs: scroll } as unknown as JobApi,
      "movies",
      "failed",
    );

    await source.init();
    expect(source.count()).toBe(3);
    expect((await drain(source)).map((job) => job.id)).toEqual(["1", "2", "3"]);
    expect(scroll.mock.calls).toEqual([
      ["movies", "failed", undefined],
      ["movies", "failed", "2"],
      ["movies", "failed", "3"],
    ]);
  });
});
