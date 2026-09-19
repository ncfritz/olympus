import { describe, expect, it } from "vitest";
import { InvalidNZBError } from "../../../../src/downloads/nzb/exceptions";
import { nzbMetadata } from "../../../../src/downloads/nzb/metadata";
import parse from "../../../../src/downloads/nzb/parser";
import { NZB_XML } from "../../../fixtures/nzb";

describe("parse", () => {
  const nzb = parse(NZB_XML);

  it("reads the head's metadata", () => {
    expect(nzb.meta).toMatchObject({
      title: "Some.Movie.2019.1080p",
      passwords: ["secret"],
      tags: ["HD"],
      category: "Movies",
    });
  });

  it("reads the files, their groups and ordered segments", () => {
    expect(nzb.names).toEqual([
      "Some.Movie.2019.1080p.mkv",
      "Some.Movie.2019.1080p.par2",
    ]);
    expect(nzb.file.name).toBe("Some.Movie.2019.1080p.mkv");
    expect(nzb.file.groups).toEqual([
      "alt.binaries.hdtv",
      "alt.binaries.movies",
    ]);
    expect(nzb.file.segments.map((s) => s.messageId)).toEqual([
      "part1@example.com",
      "part2@example.com",
    ]);
    expect(nzb.file.datetime.toISOString()).toBe("2019-10-19T15:46:40.000Z");
  });

  it("adds up the sizes", () => {
    expect(nzb.size).toBe(1800);
    expect(nzb.file.size).toBe(1700);
    expect(nzb.par2Size).toBe(100);
  });

  it("rejects malformed XML and NZBs without files", () => {
    expect(() => parse("<nzb>")).toThrow(InvalidNZBError);
    expect(() => parse("<nzb><head></head></nzb>")).toThrow(InvalidNZBError);
  });
});

describe("nzbMetadata", () => {
  it("keeps the sizes, names, meta and file summaries", () => {
    const metadata = nzbMetadata(parse(NZB_XML));

    expect(metadata).toMatchObject({
      parSize: 100,
      size: 1800,
      names: ["Some.Movie.2019.1080p.mkv", "Some.Movie.2019.1080p.par2"],
      posters: ["poster@example.com"],
      meta: { title: "Some.Movie.2019.1080p", passwords: ["secret"] },
      file: { name: "Some.Movie.2019.1080p.mkv", size: 1700 },
    });
    expect(metadata.files).toHaveLength(2);
    expect(Object.keys(metadata.file).sort()).toEqual([
      "groups",
      "name",
      "poster",
      "size",
      "subject",
      "timestamp",
    ]);
  });
});
