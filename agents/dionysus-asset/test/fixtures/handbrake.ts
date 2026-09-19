import type {
  HandbrakeScan,
  HandbrakeSubtitleTrack,
  HandbrakeTitle,
} from "../../src/tools/handbrake/scan";

/** A 2-hour 1080p title with the given audio languages and subtitles. */
export const title = (
  audio: string[] = ["eng"],
  subtitles: Partial<HandbrakeSubtitleTrack>[] = [],
  overrides: Partial<HandbrakeTitle> = {},
): HandbrakeTitle => ({
  Index: 1,
  Duration: { Ticks: 2 * 60 * 60 * 90000 },
  Geometry: { Width: 1920, Height: 1080 },
  AudioList: audio.map((LanguageCode, i) => ({
    TrackNumber: i + 1,
    LanguageCode,
  })),
  SubtitleList: subtitles.map((s, i) => ({
    TrackNumber: i + 1,
    LanguageCode: "eng",
    Name: `Subtitle ${i + 1}`,
    Attributes: {},
    ...s,
  })),
  ...overrides,
});

/** A scan whose main feature is its only title. */
export const scan = (t: HandbrakeTitle = title()): HandbrakeScan => ({
  MainFeature: 0,
  TitleList: [t],
});
