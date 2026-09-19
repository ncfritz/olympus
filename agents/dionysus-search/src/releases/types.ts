export enum QualitySource {
  UNKNOWN = 0,
  CAM = 1,
  TELESYNC = 2,
  TELECINE = 3,
  WORKPRINT = 4,
  DVD = 5,
  TV = 6,
  WEBDL = 7,
  WEBRIP = 8,
  BLURAY = 9,
}

export enum Modifier {
  NONE = 0,
  REGIONAL = 1,
  SCREENER = 2,
  RAWHD = 3,
  BRDISK = 4,
  REMUX = 5,
}

export enum Resolution {
  Unknown = 0,
  r360p = 360,
  r480p = 480,
  r540p = 540,
  r576p = 576,
  r720p = 720,
  r1080p = 1080,
  r2160p = 2160,
}

export enum QualityDetectionSource {
  Unknown,
  Title,
  Extension,
  MediaInfo,
}

export type Quality = {
  id: number;
  name: string;
  group: string;
  source: QualitySource;
  resolution: number;
  modifier: Modifier;
};

export type Revision = {
  version: number;
  real: number;
  repack: boolean;
};

export type QualityModel = {
  title: string;
  /** The release group, when the title names one. */
  releaseGroup?: string;
  quality: Quality;
  revision: Revision;
  sourceDetectionSource?: QualityDetectionSource;
  resolutionDetectionSource?: QualityDetectionSource;
  modifiersDetectionSource?: QualityDetectionSource;
  revisionDetectionSource?: QualityDetectionSource;
};

/** Copy before changing: parse results must not share it. */
export const DEFAULT_REVISION: Readonly<Revision> = Object.freeze({
  version: 1,
  real: 0,
  repack: false,
});

export const Qualities: Record<string, Quality> = {
  Unknown: {
    id: 0,
    name: "Unknown",
    group: "Unknown",
    resolution: 0,
    source: QualitySource.UNKNOWN,
    modifier: Modifier.NONE,
  },
  // Pre-release
  WORKPRINT: {
    id: 24,
    name: "WORKPRINT",
    group: "Pre-Release",
    resolution: 0,
    source: QualitySource.WORKPRINT,
    modifier: Modifier.NONE,
  },
  CAM: {
    id: 25,
    name: "CAM",
    group: "Pre-Release",
    resolution: 0,
    source: QualitySource.CAM,
    modifier: Modifier.NONE,
  },
  TELESYNC: {
    id: 26,
    name: "TELESYNC",
    group: "Pre-Release",
    resolution: 0,
    source: QualitySource.TELESYNC,
    modifier: Modifier.NONE,
  },
  TELECINE: {
    id: 27,
    name: "TELECINE",
    group: "Pre-Release",
    resolution: 0,
    source: QualitySource.TELECINE,
    modifier: Modifier.NONE,
  },
  DVDSCR: {
    id: 28,
    name: "DVDSCR",
    group: "Pre-Release",
    resolution: 480,
    source: QualitySource.DVD,
    modifier: Modifier.SCREENER,
  },
  REGIONAL: {
    id: 29,
    name: "REGIONAL",
    group: "Pre-Release",
    resolution: 480,
    source: QualitySource.DVD,
    modifier: Modifier.REGIONAL,
  },
  // SD
  SDTV: {
    id: 1,
    name: "SDTV",
    group: "SD",
    resolution: 480,
    source: QualitySource.TV,
    modifier: Modifier.NONE,
  },
  DVD: {
    id: 2,
    name: "DVD",
    group: "SD",
    resolution: 0,
    source: QualitySource.DVD,
    modifier: Modifier.NONE,
  },
  DVDR: {
    id: 23,
    name: "DVD-R",
    group: "SD",
    resolution: 480,
    source: QualitySource.DVD,
    modifier: Modifier.REMUX,
  },
  // HDTV
  HDTV720p: {
    id: 4,
    name: "HDTV-720p",
    group: "HDTV",
    resolution: 720,
    source: QualitySource.TV,
    modifier: Modifier.NONE,
  },
  HDTV1080p: {
    id: 9,
    name: "HDTV-1080p",
    group: "HDTV",
    resolution: 1080,
    source: QualitySource.TV,
    modifier: Modifier.NONE,
  },
  HDTV2160p: {
    id: 16,
    name: "HDTV-2160p",
    group: "HDTV",
    resolution: 2160,
    source: QualitySource.TV,
    modifier: Modifier.NONE,
  },
  // WEB-DL
  WEBDL480p: {
    id: 8,
    name: "WEBDL-480p",
    group: "WEBDL",
    resolution: 480,
    source: QualitySource.WEBDL,
    modifier: Modifier.NONE,
  },
  WEBDL720p: {
    id: 3,
    name: "WEBDL-720p",
    group: "WEBDL",
    resolution: 720,
    source: QualitySource.WEBDL,
    modifier: Modifier.NONE,
  },
  WEBDL1080p: {
    id: 3,
    name: "WEBDL-1080p",
    group: "WEBDL",
    resolution: 1080,
    source: QualitySource.WEBDL,
    modifier: Modifier.NONE,
  },
  WEBDL2160p: {
    id: 18,
    name: "WEBDL-2160p",
    group: "WEBDL",
    resolution: 2160,
    source: QualitySource.WEBDL,
    modifier: Modifier.NONE,
  },
  // Bluray
  Bluray480p: {
    id: 0,
    name: "Bluray-480p",
    group: "Bluray",
    resolution: 480,
    source: QualitySource.BLURAY,
    modifier: Modifier.NONE,
  },
  Bluray576p: {
    id: 0,
    name: "Bluray-576p",
    group: "Bluray",
    resolution: 576,
    source: QualitySource.BLURAY,
    modifier: Modifier.NONE,
  },
  Bluray720p: {
    id: 0,
    name: "Bluray-720p",
    group: "Bluray",
    resolution: 720,
    source: QualitySource.BLURAY,
    modifier: Modifier.NONE,
  },
  Bluray1080p: {
    id: 0,
    name: "Bluray-1080p",
    group: "Bluray",
    resolution: 1080,
    source: QualitySource.BLURAY,
    modifier: Modifier.NONE,
  },
  Bluray2160p: {
    id: 0,
    name: "Bluray-2160p",
    group: "Bluray",
    resolution: 2160,
    source: QualitySource.BLURAY,
    modifier: Modifier.NONE,
  },
  Remux1080p: {
    id: 0,
    name: "Remux-1080p",
    group: "Bluray",
    resolution: 1080,
    source: QualitySource.BLURAY,
    modifier: Modifier.REMUX,
  },
  Remux2160p: {
    id: 0,
    name: "Remux-2160p",
    group: "Bluray",
    resolution: 2160,
    source: QualitySource.BLURAY,
    modifier: Modifier.REMUX,
  },
  BRDISK: {
    id: 22,
    name: "BR-DISK",
    group: "Bluray",
    resolution: 1080,
    source: QualitySource.BLURAY,
    modifier: Modifier.BRDISK,
  },
  // Others
  RAWHD: {
    id: 10,
    name: "Raw-HD",
    group: "Other",
    resolution: 1080,
    source: QualitySource.TV,
    modifier: Modifier.RAWHD,
  },
  // WEBRip
  WEBRip480p: {
    id: 12,
    name: "WEBRip-480p",
    group: "WEBRip",
    resolution: 480,
    source: QualitySource.WEBRIP,
    modifier: Modifier.NONE,
  },
  WEBRip720p: {
    id: 14,
    name: "WEBRip-720p",
    group: "WEBRip",
    resolution: 720,
    source: QualitySource.WEBRIP,
    modifier: Modifier.NONE,
  },
  WEBRip1080p: {
    id: 15,
    name: "WEBRip-1080p",
    group: "WEBRip",
    resolution: 1080,
    source: QualitySource.WEBRIP,
    modifier: Modifier.NONE,
  },
  WEBRip2160p: {
    id: 17,
    name: "WEBRip-2160p",
    group: "WEBRip",
    resolution: 2160,
    source: QualitySource.WEBRIP,
    modifier: Modifier.NONE,
  },
};

export const EXTENSION_QUALITIES: Record<string, Quality> = {
  // Unknown
  webm: Qualities.Unknown,
  // SDTV
  m4v: Qualities.SDTV,
  "3gp": Qualities.SDTV,
  nsv: Qualities.SDTV,
  ty: Qualities.SDTV,
  strm: Qualities.SDTV,
  rm: Qualities.SDTV,
  rmvb: Qualities.SDTV,
  m3u: Qualities.SDTV,
  ifo: Qualities.SDTV,
  mov: Qualities.SDTV,
  qt: Qualities.SDTV,
  divx: Qualities.SDTV,
  xvid: Qualities.SDTV,
  bivx: Qualities.SDTV,
  nrg: Qualities.SDTV,
  pva: Qualities.SDTV,
  wmv: Qualities.SDTV,
  asf: Qualities.SDTV,
  asx: Qualities.SDTV,
  ogm: Qualities.SDTV,
  ogv: Qualities.SDTV,
  m2v: Qualities.SDTV,
  avi: Qualities.SDTV,
  bin: Qualities.SDTV,
  dat: Qualities.SDTV,
  "dvr-ms": Qualities.SDTV,
  mpg: Qualities.SDTV,
  mpeg: Qualities.SDTV,
  mp4: Qualities.SDTV,
  avc: Qualities.SDTV,
  vp3: Qualities.SDTV,
  svq3: Qualities.SDTV,
  nuv: Qualities.SDTV,
  viv: Qualities.SDTV,
  dv: Qualities.SDTV,
  fli: Qualities.SDTV,
  flv: Qualities.SDTV,
  wpl: Qualities.SDTV,
  // DVD
  img: Qualities.DVD,
  iso: Qualities.DVD,
  vob: Qualities.DVD,
  // HD
  mkv: Qualities.WEBDL720p,
  mk3d: Qualities.WEBDL720p,
  ts: Qualities.SDTV,
  wtv: Qualities.SDTV,
  // Bluray
  m2ts: Qualities.Bluray720p,
};
