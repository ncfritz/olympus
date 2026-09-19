import { describe, expect, it } from "vitest";
import { DEFAULT_HANDBRAKE_CONFIG } from "../../../../src/media/planning/defaultHandbrakeJob";
import { planTranscode } from "../../../../src/media/planning/planTranscode";
import { scan, title } from "../../../fixtures/handbrake";

const scale = (plan: ReturnType<typeof planTranscode>) =>
  plan.job[0].Job.Filters.FilterList.find((f) => f.ID === 20)!.Settings;

describe("planTranscode", () => {
  const tracks = { videoStreamIndex: 1, audioStreamIndex: 2 };

  it("fills in the source, destination, title, range and audio", () => {
    const plan = planTranscode(
      scan(title(["fre", "eng"])),
      tracks,
      "/staging/original.mkv",
      "/staging/transcoded.mp4",
    );
    const { Job } = plan.job[0];

    expect(Job.Source).toMatchObject({
      Path: "/staging/original.mkv",
      Title: 1,
      Range: { Type: "time", Start: 0, End: 2 * 60 * 60 * 90000 },
    });
    expect(Job.Destination.File).toBe("/staging/transcoded.mp4");
    expect(Job.Audio.AudioList.map((a) => a.Track)).toEqual([1, 1]);
    expect(plan.duration).toBe(2 * 60 * 60);
  });

  it("keeps 1080p and scales anything wider down to 1920", () => {
    const hd = planTranscode(scan(), tracks, "in", "out");
    expect([hd.width, hd.height]).toEqual([1920, 1080]);
    expect(scale(hd)).toMatchObject({ width: "1920", height: "1080" });

    const uhd = planTranscode(
      scan(title(["eng"], [], { Geometry: { Width: 3840, Height: 1600 } })),
      tracks,
      "in",
      "out",
    );
    expect(uhd).toMatchObject({
      originalWidth: 3840,
      originalHeight: 1600,
      width: 1920,
      height: 800,
    });
    expect(scale(uhd)).toMatchObject({ width: "1920", height: "800" });
  });

  it("burns in the chosen subtitle instead of searching", () => {
    const plan = planTranscode(
      scan(title(["eng"], [{}, { Name: "English (Forced)" }])),
      { ...tracks, subtitleStreamIndex: 2 },
      "in",
      "out",
    );
    const { Subtitle } = plan.job[0].Job;

    expect(Subtitle.Search).toBeUndefined();
    expect(Subtitle.SubtitleList).toEqual([
      expect.objectContaining({
        Burn: true,
        ID: 2,
        Track: 1,
        Name: "English (Forced)",
      }),
    ]);
  });

  it("searches for forced subtitles when none was chosen", () => {
    const { Subtitle } = planTranscode(scan(), tracks, "in", "out").job[0].Job;

    expect(Subtitle.SubtitleList).toEqual([]);
    expect(Subtitle.Search).toEqual({
      Burn: true,
      Default: false,
      Enable: true,
      Forced: true,
    });
  });

  it("leaves the default job alone", () => {
    const before = JSON.stringify(DEFAULT_HANDBRAKE_CONFIG);
    planTranscode(scan(), tracks, "in", "out");
    expect(JSON.stringify(DEFAULT_HANDBRAKE_CONFIG)).toBe(before);
  });
});
