import type { HttpService } from "@nestjs/axios";
import { parse } from "node-html-parser";
import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { DpvMetadataExtractor } from "../../../../src/content/extractors/DpvMetadataExtractor";
import { LocalMetadataExtractor } from "../../../../src/content/extractors/LocalMetadataExtractor";
import { PhMetadataExtractor } from "../../../../src/content/extractors/PhMetadataExtractor";
import { XhMetadataExtractor } from "../../../../src/content/extractors/XhMetadataExtractor";
import { XvMetadataExtractor } from "../../../../src/content/extractors/XvMetadataExtractor";
import { IngestError } from "../../../../src/tools/errors/IngestError";
import {
  DPV_PAGE,
  FMP4_MEDIA_PLAYLIST,
  MASTER_PLAYLIST,
  MEDIA_PLAYLIST,
  PH_PAGE,
  XH_PAGE,
  XV_PAGE,
  XV_PAGE_WITHOUT_HLS,
} from "../../../fixtures/pages";

/** An HttpService serving `responses` by URL. */
const http = (responses: Record<string, string>) => {
  const get = vi.fn((url: string) => {
    if (!(url in responses)) throw new Error(`Unexpected GET ${url}`);
    return of({ data: responses[url] });
  });
  return { get } as unknown as HttpService & { get: typeof get };
};

describe("XvMetadataExtractor", () => {
  const base = "https://cdn.example.com/xv/abc";

  it("reads the title from the player script", async () => {
    const extractor = new XvMetadataExtractor(http({}), "url", "id-1");
    expect(await extractor.getTitle(parse(XV_PAGE))).toBe("A sample title");
    expect(await extractor.getTitle(parse("<html></html>"))).toBe("id-1");
  });

  it("follows the HLS playlist to its best rendition up to 720p", async () => {
    const extractor = new XvMetadataExtractor(
      http({
        [`${base}/hls.m3u8`]: MASTER_PLAYLIST,
        [`${base}/720p.m3u8`]: MEDIA_PLAYLIST,
      }),
      "url",
      "id",
    );
    expect(await extractor.getSegmentUrls(parse(XV_PAGE))).toEqual([
      `${base}/seg-1.ts`,
      `${base}/seg-2.ts`,
    ]);
  });

  it("falls back to the page's contentUrl", async () => {
    const extractor = new XvMetadataExtractor(http({}), "url", "id");
    expect(await extractor.getSegmentUrls(parse(XV_PAGE_WITHOUT_HLS))).toEqual([
      `${base}/video.mp4`,
    ]);
  });

  it("fails without a playlist or content URL", async () => {
    const extractor = new XvMetadataExtractor(http({}), "url", "id");
    await expect(
      extractor.getSegmentUrls(parse("<html><head></head></html>")),
    ).rejects.toThrow(IngestError);
  });
});

describe("PhMetadataExtractor", () => {
  it("reads the title", async () => {
    const extractor = new PhMetadataExtractor(http({}), "url", "id");
    expect(await extractor.getTitle(parse(PH_PAGE))).toBe("A sample title");
  });

  it("picks the best definition up to 720p", async () => {
    const base = "https://cdn.example.com/ph/720";
    const extractor = new PhMetadataExtractor(
      http({
        [`${base}/master.m3u8`]: MASTER_PLAYLIST,
        [`${base}/360p.m3u8`]: MEDIA_PLAYLIST,
      }),
      "url",
      "id",
    );
    expect(await extractor.getSegmentUrls(parse(PH_PAGE))).toEqual([
      `${base}/seg-1.ts`,
      `${base}/seg-2.ts`,
    ]);
  });

  it("fails without a player config", async () => {
    const extractor = new PhMetadataExtractor(http({}), "url", "id");
    await expect(
      extractor.getSegmentUrls(parse("<html></html>")),
    ).rejects.toThrow(IngestError);
  });
});

describe("XhMetadataExtractor", () => {
  const base = "https://cdn.example.com/xh/abc";

  it("reads the title from og:title", async () => {
    const extractor = new XhMetadataExtractor(http({}), "url", "id");
    expect(await extractor.getTitle(parse(XH_PAGE))).toBe("A sample title");
  });

  it("starts the segments with the fMP4 init segment", async () => {
    const extractor = new XhMetadataExtractor(
      http({
        [`${base}/master.m3u8`]: MASTER_PLAYLIST,
        [`${base}/720p.m3u8`]: FMP4_MEDIA_PLAYLIST,
      }),
      "url",
      "id",
    );
    expect(await extractor.getSegmentUrls(parse(XH_PAGE))).toEqual([
      `${base}/init.mp4`,
      `${base}/seg-1.m4s`,
      `${base}/seg-2.m4s`,
    ]);
  });
});

describe("DpvMetadataExtractor", () => {
  it("derives the video URL from the page URL", async () => {
    const extractor = new DpvMetadataExtractor(
      http({}),
      "https://dp-vids.com/videos/12345/a-title/",
      "id",
    );
    expect(await extractor.getSegmentUrls(parse(DPV_PAGE))).toEqual([
      "https://dp-vids.com/contents/videos/12000/12345/12345.mp4",
    ]);
    expect(await extractor.getTitle(parse(DPV_PAGE))).toBe("A sample title");
  });

  it("fails on other URLs", async () => {
    const extractor = new DpvMetadataExtractor(
      http({}),
      "https://example.com/v/1",
      "id",
    );
    await expect(extractor.getSegmentUrls(parse(DPV_PAGE))).rejects.toThrow(
      IngestError,
    );
  });
});

describe("LocalMetadataExtractor", () => {
  it("names local files after their base name", async () => {
    const extractor = new LocalMetadataExtractor(
      http({}),
      "/imports/holiday.clip.mp4",
      "id",
    );
    expect(extractor.isLocal()).toBe(true);
    expect(extractor.url).toBe("file:///imports/holiday.clip.mp4");
    expect(await extractor.getTitle(parse(""))).toBe("holiday.clip");
    expect(await extractor.getSegmentUrls(parse(""))).toEqual([]);
  });
});
