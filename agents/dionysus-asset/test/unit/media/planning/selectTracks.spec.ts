import { describe, expect, it } from "vitest";
import { selectTracks } from "../../../../src/media/planning/selectTracks";
import { scan, title } from "../../../fixtures/handbrake";

describe("selectTracks", () => {
  it("configures a single-audio title without approval", () => {
    expect(selectTracks(scan(title(["eng"])))).toMatchObject({
      audioTrackIndex: 1,
      subtitleTrackIndex: undefined,
      configurationRequiresApproval: false,
      transcodeVerificationRequired: false,
    });
  });

  it("picks the English audio track among other languages", () => {
    expect(selectTracks(scan(title(["fre", "eng", "ger"])))).toMatchObject({
      audioTrackIndex: 2,
      configurationRequiresApproval: false,
    });
  });

  it("asks for approval when several audio tracks are English", () => {
    expect(selectTracks(scan(title(["fre", "eng", "eng"])))).toMatchObject({
      audioTrackIndex: 2,
      configurationRequiresApproval: true,
    });
  });

  it("keeps the first track when none is English", () => {
    expect(selectTracks(scan(title(["fre", "ger"])))).toMatchObject({
      audioTrackIndex: 1,
      configurationRequiresApproval: false,
    });
  });

  it("burns in a lone forced English subtitle and verifies the result", () => {
    const selection = selectTracks(
      scan(title(["eng"], [{ Attributes: { Forced: true } }])),
    );
    expect(selection).toMatchObject({
      subtitleTrackIndex: 1,
      configurationRequiresApproval: false,
      transcodeVerificationRequired: true,
    });
  });

  it("ignores a lone unforced English subtitle", () => {
    expect(selectTracks(scan(title(["eng"], [{}])))).toMatchObject({
      subtitleTrackIndex: undefined,
      transcodeVerificationRequired: false,
    });
  });

  it("picks the forced one of several English subtitles", () => {
    const selection = selectTracks(
      scan(title(["eng"], [{}, { Attributes: { Forced: true } }])),
    );
    expect(selection).toMatchObject({
      subtitleTrackIndex: 2,
      configurationRequiresApproval: false,
      transcodeVerificationRequired: true,
    });
  });

  it("finds the forced English subtitle wherever it is listed", () => {
    const forced = { Attributes: { Forced: true } };

    expect(selectTracks(scan(title(["eng"], [{}, {}, forced])))).toMatchObject({
      subtitleTrackIndex: 3,
      configurationRequiresApproval: false,
      transcodeVerificationRequired: true,
    });
    expect(selectTracks(scan(title(["eng"], [forced, {}, {}])))).toMatchObject({
      subtitleTrackIndex: 1,
      configurationRequiresApproval: false,
      transcodeVerificationRequired: true,
    });
  });

  it("picks the first of several forced English subtitles", () => {
    const forced = { Attributes: { Forced: true } };
    expect(
      selectTracks(scan(title(["eng"], [{}, forced, forced]))),
    ).toMatchObject({ subtitleTrackIndex: 2 });
  });

  it("asks for approval when several English subtitles are unforced", () => {
    expect(selectTracks(scan(title(["eng"], [{}, {}])))).toMatchObject({
      subtitleTrackIndex: undefined,
      configurationRequiresApproval: true,
    });
  });

  it("ignores subtitles in other languages", () => {
    expect(
      selectTracks(
        scan(
          title(
            ["eng"],
            [{ LanguageCode: "fre", Attributes: { Forced: true } }],
          ),
        ),
      ),
    ).toMatchObject({ subtitleTrackIndex: undefined });
  });
});
