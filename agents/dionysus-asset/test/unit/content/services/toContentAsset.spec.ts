import { describe, expect, it } from "vitest";
import { toContentAsset } from "../../../../src/content/services/AssetWorkflow";

describe("toContentAsset", () => {
  it("maps an ingested file's metadata to the content asset the API records", () => {
    expect(
      toContentAsset({
        id: "asset-1",
        name: "clip.mov",
        created_date: "2026-09-20",
        inputSha256: "in",
        outputSha256: "out",
        originalSize: 2000,
        assetSize: 1000,
        duration: 61_000,
        width: 1920,
        height: 1080,
      }),
    ).toEqual({
      id: "asset-1",
      originalName: "clip.mov",
      originalSha: "in",
      originalSizeBytes: 2000,
      newSha: "out",
      newSizeBytes: 1000,
      durationMs: 61_000,
      width: 1920,
      height: 1080,
    });
  });
});
