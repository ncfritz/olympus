import { describe, expect, it } from "vitest";
import { scoreRelease } from "../../../src/releases/scoreRelease";

/** `type:value:score` of each tag, for compact expectations. */
const tagsOf = (title: string) =>
  scoreRelease(title).tags.map((t) => `${t.type}:${t.value}:${t.score}`);

/**
 * Release titles as NZBGeek returns them, parsed and scored.
 */
describe("scoreRelease", () => {
  it.each([
    [
      "The.Matrix.1999.1080p.BluRay.x264-SPARKS",
      { name: "Bluray-1080p", group: "Bluray", resolution: 1080 },
    ],
    [
      "The.Office.US.S05E14.720p.WEB-DL.DD5.1.H.264-NTb",
      { name: "WEBDL-720p", group: "WEBDL", resolution: 720 },
    ],
    [
      "Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX",
      { name: "WEBDL-2160p", group: "WEBDL", resolution: 2160 },
    ],
    [
      "Show.S01E01.720p.HDTV.x264-KILLERS",
      { name: "HDTV-720p", group: "HDTV", resolution: 720 },
    ],
    ["Some.Movie.2010.DVDRip.XviD-GRP", { name: "DVD", group: "SD" }],
  ])("detects the quality of %s", (title, quality) => {
    expect(scoreRelease(title).titleInfo.quality).toMatchObject(quality);
  });

  it("detects repacks", () => {
    expect(
      scoreRelease("Severance.S02E01.REPACK.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb")
        .titleInfo.revision,
    ).toEqual({ version: 2, real: 0, repack: true });
  });

  it("tags and scores audio, codecs, services and repacks", () => {
    const scored = scoreRelease(
      "Severance.S02E01.REPACK.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb",
    );
    expect(scored.tags.map((t) => `${t.type}:${t.value}:${t.score}`)).toEqual(
      expect.arrayContaining([
        "audioChannel:5.1 Surround:0",
        "audioFormat:DD+:1750",
        "streamingServices:ATVP:0",
        "misc:Repack/Proper:5",
        "videoCodec:x264:0",
      ]),
    );
    expect(scored.score).toBe(
      scored.tags.reduce((sum, tag) => sum + tag.score, 0),
    );
  });

  it("tags Atmos over its core format", () => {
    expect(
      tagsOf("Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX"),
    ).toEqual(
      expect.arrayContaining([
        "audioFormat:DD+ ATMOS:3000",
        "hdr:DV Boost:1000",
        "hdr:HDR:500",
      ]),
    );
  });

  it("penalises x265 at HD resolutions", () => {
    expect(tagsOf("Some.Movie.2019.1080p.BluRay.x265-RARBG")).toContain(
      "unwanted:x265 (HD):-10000",
    );
  });

  it("parses empty titles as unknown", () => {
    expect(scoreRelease("").titleInfo.quality.name).toBe("Unknown");
  });

  it("does not carry a repack over to the next title", () => {
    scoreRelease("Severance.S02E01.REPACK.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb");
    expect(
      scoreRelease("The.Matrix.1999.1080p.BluRay.x264-SPARKS").titleInfo
        .revision.repack,
    ).toBe(false);
  });

  it.each([
    [
      "Oppenheimer.2023.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FraMeSToR",
      "Remux-2160p",
    ],
    ["The.Matrix.1999.1080p.BluRay.REMUX.AVC.DTS-HD.MA.5.1-FGT", "Remux-1080p"],
    ["The.Matrix.1999.BluRay.REMUX.AVC-FGT", "Remux-1080p"],
    ["The.Matrix.1999.2160p.UHD.BluRay.x265-TERMiNAL", "Bluray-2160p"],
  ])("detects the remux quality of %s", (title, name) => {
    expect(scoreRelease(title).titleInfo.quality.name).toBe(name);
  });

  it("doesn't treat a UHD remux as HD x265", () => {
    expect(
      tagsOf(
        "Oppenheimer.2023.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FraMeSToR",
      ),
    ).not.toContain("unwanted:x265 (HD):-10000");
  });

  it("tags resolution-only formats", () => {
    expect(tagsOf("The.Matrix.1999.1080p.BluRay.x264-SPARKS")).toContain(
      "resolution:1080p:50",
    );
  });

  it("requires every condition of a format, not any one", () => {
    // Generated Dynamic HDR is a listed group AND HDR10+/DV; FLUX isn't one.
    expect(
      tagsOf("Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX"),
    ).not.toContain("unwanted:Generated Dynamic HDR:-10000");
  });

  it("penalises releases without a group", () => {
    expect(tagsOf("Some.Movie.2020.1080p.WEB-DL.DDP5.1.H.264")).toContain(
      "releaseGroups:No-RlsGroup:-10000",
    );
    expect(tagsOf("The.Matrix.1999.1080p.BluRay.x264-SPARKS")).not.toContain(
      "releaseGroups:No-RlsGroup:-10000",
    );
  });

  it("tags release groups", () => {
    expect(
      tagsOf("The.Office.US.S05E14.720p.WEB-DL.DD5.1.H.264-NTb"),
    ).toContain("releaseGroups:WEB Tier 01:1700");
  });
});
