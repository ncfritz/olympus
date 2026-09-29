/**
 * Shape of the HandBrake scan JSON we publish to the CDN alongside each media
 * asset.
 *
 * Like the ffprobe metadata this is not generated from the API spec: the files
 * come straight from `HandBrakeCLI --json --scan`, so the contract is
 * HandBrake's output. Only the fields the UI reads are declared.
 */

/** Track flags; HandBrake writes these as booleans. */
export interface HandBrakeTrackAttributes {
  "4By3"?: boolean;
  AltCommentary?: boolean;
  Children?: boolean;
  ClosedCaption?: boolean;
  Commentary?: boolean;
  Default?: boolean;
  Forced?: boolean;
  Large?: boolean;
  Letterbox?: boolean;
  Normal?: boolean;
  PanScan?: boolean;
  Secondary?: boolean;
  VisuallyImpaired?: boolean;
  Wide?: boolean;
}

export interface HandBrakeAudioTrack {
  TrackNumber?: number;
  Description?: string;
  Name?: string;
  Language?: string;
  LanguageCode?: string;
  Codec?: number;
  CodecName?: string;
  CodecParam?: number;
  BitRate?: number;
  SampleRate?: number;
  ChannelCount?: number;
  ChannelLayout?: number;
  ChannelLayoutName?: string;
  LFECount?: number;
  Attributes: HandBrakeTrackAttributes;
}

export interface HandBrakeSubtitleTrack {
  TrackNumber?: number;
  Name?: string;
  Language?: string;
  LanguageCode?: string;
  Format?: number;
  Source?: number;
  SourceName?: string;
  Attributes: HandBrakeTrackAttributes;
}

/** HandBrake splits durations into their parts and a tick count. */
export interface HandBrakeDuration {
  Hours: number;
  Minutes: number;
  Seconds: number;
  Ticks: number;
}

export interface HandBrakeChapter {
  Name?: string;
  Duration: HandBrakeDuration;
}

export interface HandBrakeRational {
  Num: number;
  Den: number;
}

export interface HandBrakeGeometry {
  Width?: number;
  Height?: number;
  PAR: HandBrakeRational;
}

export interface HandBrakeColor {
  BitDepth?: number;
  ChromaLocation?: number;
  ChromaSubsampling?: string;
  Format?: number;
  Matrix?: number;
  Primary?: number;
  Range?: number;
  Transfer?: number;
}

export interface HandBrakeTitle {
  Index: number;
  Name: string;
  Path: string;
  Container: string;
  Type: number;
  Playlist: number;
  VideoCodec: string;
  InterlaceDetected: boolean;
  KeepDuplicateTitles: boolean;
  /** Top, bottom, left and right, in pixels. */
  Crop?: number[];
  Duration: HandBrakeDuration;
  FrameRate: HandBrakeRational;
  Geometry: HandBrakeGeometry;
  Color: HandBrakeColor;
  Metadata?: Record<string, string>;
  AudioList?: HandBrakeAudioTrack[];
  SubtitleList?: HandBrakeSubtitleTrack[];
  ChapterList?: HandBrakeChapter[];
}

export interface HandBrakeMetadata {
  /** Index into TitleList of the title HandBrake considers the main feature. */
  MainFeature: number;
  TitleList: HandBrakeTitle[];
}
