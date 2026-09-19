import { describe, expect, it } from "vitest";
import { parseReleaseGroup } from "../../../src/releases/releaseGroup";

describe("parseReleaseGroup", () => {
  it.each([
    ["The.Matrix.1999.1080p.BluRay.x264-SPARKS", "SPARKS"],
    ["Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX", "FLUX"],
    ["The.Office.US.S05E14.720p.WEB-DL.DD5.1.H.264-NTb", "NTb"],
    ["Some.Movie.2010.DVDRip.XviD-GRP", "GRP"],
    ["Some.Movie.2020.1080p.WEB-DL.DDP5.1.H.264-NTb-Obfuscated", "NTb"],
    ["Some.Movie.2020.1080p.WEB-DL.H.264-NTb[rartv]", "NTb"],
    ["Some.Movie.2020.1080p.WEB-DL.H.264-NTb.mkv", "NTb"],
    ["Some.Movie.2020.1080p.BluRay.DD5.1.x264-D-Z0N3", "D-Z0N3"],
    ["Some Movie (2020) [1080p] [BluRay] [YTS.MX]", "YTS.MX"],
    ["Some Movie (2020) (1080p BluRay x265 10bit Tigole)", "Tigole"],
    ["[SubsPlease] Some Show - 01 (1080p)", "SubsPlease"],
  ])("finds the group of %s", (title, group) => {
    expect(parseReleaseGroup(title)).toBe(group);
  });

  it.each([
    "Some.Movie.2020.1080p.WEB-DL",
    "Some.Movie.2020.1080p.BluRay.DTS-HD.MA.5.1",
    "Some.Movie.2020.1080p.WEB-DL.H.264-12345",
    "Some.Movie.2020.1080p.WEB-DL.H.264-deadbeef",
    "Some.Movie.2020.1080p.WEB.H264",
  ])("finds no group in %s", (title) => {
    expect(parseReleaseGroup(title)).toBeUndefined();
  });
});
