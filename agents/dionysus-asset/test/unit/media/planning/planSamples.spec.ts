import { describe, expect, it } from "vitest";
import { planTranscode } from "../../../../src/media/planning/planTranscode";
import {
  planSample,
  sampleHeight,
  sampleStartTimes,
  timestampToMs,
} from "../../../../src/media/planning/planSamples";
import { scan } from "../../../fixtures/handbrake";

describe("timestampToMs", () => {
  it("reads SRT timestamps", () => {
    expect(timestampToMs("00:00:00,000")).toBe(0);
    expect(timestampToMs("01:02:03,456")).toBe(3_723_456);
  });
});

describe("sampleStartTimes", () => {
  it("spreads six samples over the duration", () => {
    expect(sampleStartTimes(600)).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it("spreads them over the subtitles when there are some", () => {
    const subtitles = Array.from({ length: 12 }, (_, i) => ({
      start: `00:${String(i).padStart(2, "0")}:30,500`,
    }));
    expect(sampleStartTimes(7200, subtitles)).toEqual([
      30, 150, 270, 390, 510, 630,
    ]);
  });
});

describe("planSample", () => {
  const { job } = planTranscode(
    scan(),
    { videoStreamIndex: 1, audioStreamIndex: 1 },
    "/remote/original.mkv",
    "/remote/transcoded.mp4",
  );

  it("cuts 90 seconds at 480 wide from the transcode job", () => {
    const [sample] = planSample(
      job,
      300,
      sampleHeight(1080),
      "/staging/original.mkv",
      "/staging/sample2.mp4",
    );

    expect(sample.Job.Source).toMatchObject({
      Path: "/staging/original.mkv",
      Range: { Type: "time", Start: 300 * 90000, End: 390 * 90000 },
    });
    expect(sample.Job.Destination.File).toBe("/staging/sample2.mp4");
    expect(
      sample.Job.Filters.FilterList.find((f) => f.ID === 20)!.Settings,
    ).toMatchObject({ width: "480", height: "270" });
  });

  it("leaves the transcode job alone", () => {
    planSample(job, 300, 270, "in", "out");
    expect(job[0].Job.Source.Path).toBe("/remote/original.mkv");
  });
});
