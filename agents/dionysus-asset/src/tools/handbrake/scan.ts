/**
 * HandBrakeCLI's scan (`--scan --json`, "JSON Title Set"), trimmed to what
 * the transcode planning reads. Track numbers are 1-based.
 */
export type HandbrakeAudioTrack = {
  TrackNumber: number;
  LanguageCode: string;
};

export type HandbrakeSubtitleTrack = {
  TrackNumber: number;
  LanguageCode: string;
  Name: string;
  Attributes: { Forced?: boolean };
};

export type HandbrakeTitle = {
  Index: number;
  /** In 90 kHz ticks. */
  Duration: { Ticks: number };
  Geometry: { Width: number; Height: number };
  AudioList: HandbrakeAudioTrack[];
  SubtitleList: HandbrakeSubtitleTrack[];
};

export type HandbrakeScan = {
  MainFeature: number;
  TitleList: HandbrakeTitle[];
};
