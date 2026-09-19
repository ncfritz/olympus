import {
  DEFAULT_REVISION,
  EXTENSION_QUALITIES,
  Modifier,
  Qualities,
  QualityDetectionSource,
  QualityModel,
  QualitySource,
  Resolution,
} from "./types";

const RESOLUTION_REGEX = new RegExp(
  "\\b(?:(?<r360p>360p)|(?<r480p>480p|480i|640x480|848x480)|(?<r540p>540p)|(?<r576p>576p)|(?<r720p>720p|1280x720|960p)|(?<r1080p>1080p|1920x1080|1440p|FHD|1080i|4kto1080p)|(?<r2160p>2160p|3840x2160|4k[-_. ](?:UHD|HEVC|BD|H\\.?265)|(?:UHD|HEVC|BD|H\\.?265)[-_. ]4k)|UHD|\\[4k\\])\\b",
  "i",
);
const SOURCE_REGEX = new RegExp(
  "\\b(?:(?<bluray>M?Blu[-_. ]?Ray|HD[-_. ]?DVD|BD(?!$)|UHD2?BD|BDISO|BDMux|BD25|BD50|BR[-_. ]?DISK)|(?<webdl>WEB[-_. ]?DL(?:mux)?|AmazonHD|AmazonSD|iTunesHD|MaxdomeHD|NetflixU?HD|WebHD|HBOMaxHD|DisneyHD|[. ]WEB[. ](?:[xh][ .]?26[45]|AVC|HEVC|DDP?5[. ]1)|[. ](?-i:WEB)$|(?:\\d{3,4}0p)[-. ](?:Hybrid[-_. ]?)?WEB[-. ]|[-. ]WEB[-. ]\\d{3,4}0p|\\b\\s\\/\\sWEB\\s\\/\\s\\b|(?:AMZN|NF|DP)[. -]WEB[. -](?!Rip))|(?<webrip>WebRip|Web-Rip|WEBMux)|(?<hdtv>HDTV)|(?<bdrip>BDRip|BDLight|HD[-_. ]?DVDRip|UHDBDRip)|(?<brrip>BRRip)|(?<dvdr>\\d?x?M?DVD-?[R59])|(?<dvd>DVD(?!-R)|DVDRip|xvidvd)|(?<dsr>WS[-_. ]DSR|DSR)|(?<regional>R[0-9]{1}|REGIONAL)|(?<scr>SCR|SCREENER|DVDSCR|DVDSCREENER)|(?<ts>TS[-_. ]|TELESYNCH?|HD-TS|HDTS|PDVD|TSRip|HDTSRip)|(?<tc>TC|TELECINE|HD-TC|HDTC)|(?<cam>CAMRIP|(?:NEW)?CAM|HD-?CAM(?:Rip)?|HQCAM)|(?<wp>WORKPRINT|WP)|(?<pdtv>PDTV)|(?<sdtv>SDTV)|(?<tvrip>TVRip))(?:\\b|$|[ .])",
  "i",
);
const VERSION_REGEX = new RegExp(
  "\\d[-._ ]?v(\\d)[-._ ]|\\[v(\\d)]|repack(\\d)|rerip(\\d)",
  "i",
);
const PROPER_REGEX = new RegExp("\\b(>proper)\\b", "i");
const REPACK_REGEX = new RegExp("\\b(repack\\d?|rerip\\d?)\\b", "i");
const REAL_REGEX = new RegExp("\\b(REAL)\\b");
const CODEC_REGEX = new RegExp(
  "\\b(?:(?<x264>x264)|(?<h264>h264)|(?<xvidhd>XvidHD)|(?<xvid>X-?vid)|(?<divx>divx))\\b",
  "i",
);
const REMUX_REGEX = new RegExp(
  "(?:[_. \\[]|\\d{4}p-|\\bHybrid-)((?:(BD|UHD)[-_. ]?)?Remux)\\b|((?:(BD|UHD)[-_. ]?)?Remux[_. ]\\d{4}p)",
  "i",
);
const BR_DISK_REGEX = new RegExp(
  "^(?!.*\\b((?<!HD[._ -]|HD)DVD|BDRip|720p|MKV|XviD|WMV|d3g|(BD)?REMUX|^(?=.*1080p)(?=.*HEVC)|[xh][-_. ]?26[45]|German.*[DM]L|((?<=\\d{4}).*German.*([DM]L)?)(?=.*\\b(AVC|HEVC|VC[-_. ]?1|MVC|MPEG[-_. ]?2)\\b))\\b)(((?=.*\\b(Blu[-_. ]?ray|BD|HD[-_. ]?DVD)\\b)(?=.*\\b(AVC|HEVC|VC[-_. ]?1|MVC|MPEG[-_. ]?2|BDMV|ISO)\\b))|^((?=.*\\b(((?=.*\\b((.*_)?COMPLETE.*|Dis[ck])\\b)(?=.*(Blu[-_. ]?ray|HD[-_. ]?DVD)))|3D[-_. ]?BD|BR[-_. ]?DISK|Full[-_. ]?Blu[-_. ]?ray|^((?=.*((BD|UHD)[-_. ]?(25|50|66|100|ISO)))))))).*",
  "i",
);
const RAW_HD_REGEX = new RegExp("b(?<rawhd>RawHD|Raw[-_. ]HD)\\b", "i");
const MPEG2_REGEX = new RegExp("\\b(?<mpeg2>MPEG[-_. ]?2)\\b", "i");
const HIGH_DEF_PDTV_REGEX = new RegExp("hr[-_. ]ws", "i");
const OTHER_SOURCE_MATCH = new RegExp(
  "(?<hdtv>HD[-_. ]TV)|(?<sdtv>SD[-_. ]TV)",
  "i",
);

export const parseTitle = (title: string): QualityModel => {
  const normalizedTitle = title.trim();

  if (normalizedTitle === "") {
    return {
      title: normalizedTitle,
      quality: Qualities.Unknown,
      revision: { ...DEFAULT_REVISION },
    };
  }

  const result = parseTitleInternal(normalizedTitle);

  if (
    result.quality === Qualities.Unknown &&
    !containsInvalidChars(normalizedTitle)
  ) {
    const quality = getQualityForExtension(normalizedTitle);

    if (quality) {
      result.quality = quality;
      result.sourceDetectionSource = QualityDetectionSource.Extension;
      result.resolutionDetectionSource = QualityDetectionSource.Extension;
      result.modifiersDetectionSource = QualityDetectionSource.Extension;
    }
  }

  return result;
};

const parseTitleInternal = (title: string): QualityModel => {
  const normalizedTitle = title.replace("_", " ");
  const result = parseQualityModifiers(normalizedTitle);

  const sourceMatches = normalizedTitle.match(SOURCE_REGEX);
  const resolution = parseResolution(normalizedTitle);
  const codexMatches = normalizedTitle.match(CODEC_REGEX);
  const remuxMatch = normalizedTitle.match(REMUX_REGEX);
  const brDiskMatch = normalizedTitle.match(BR_DISK_REGEX);
  const rawHdMatch = normalizedTitle.match(RAW_HD_REGEX);

  if (rawHdMatch && !brDiskMatch) {
    result.sourceDetectionSource = QualityDetectionSource.Title;
    result.resolutionDetectionSource = QualityDetectionSource.Title;
    result.quality = Qualities.RAWHD;

    return result;
  }

  if (resolution !== Resolution.Unknown) {
    result.resolutionDetectionSource = QualityDetectionSource.Title;
  }

  if (sourceMatches) {
    result.sourceDetectionSource = QualityDetectionSource.Title;

    if (getReGroup(sourceMatches, "bluray")) {
      if (brDiskMatch) {
        result.quality = Qualities.BRDISK;
      } else if (
        getReGroup(codexMatches, "xvid") ||
        getReGroup(codexMatches, "divx")
      ) {
        result.quality = Qualities.Bluray480p;
      } else if (resolution === Resolution.r2160p) {
        result.quality = remuxMatch
          ? Qualities.Remux2160p
          : Qualities.Bluray2160p;
      } else if (remuxMatch && resolution !== Resolution.r720p) {
        // A remux of unknown resolution is taken as 1080p.
        result.quality = Qualities.Remux1080p;
      } else if (resolution === Resolution.r1080p) {
        result.quality = remuxMatch
          ? Qualities.Remux1080p
          : Qualities.Bluray1080p;
      } else if (resolution === Resolution.r720p) {
        result.quality = Qualities.Bluray720p;
      } else if (resolution === Resolution.r576p) {
        result.quality = Qualities.Bluray576p;
      } else if (
        resolution === Resolution.r360p ||
        resolution === Resolution.r480p ||
        resolution === Resolution.r540p
      ) {
        result.quality = Qualities.Bluray480p;
      } else {
        result.quality = Qualities.Bluray720p;
      }
    } else if (getReGroup(sourceMatches, "webdl")) {
      if (resolution === Resolution.r2160p) {
        result.quality = Qualities.WEBDL2160p;
      } else if (resolution === Resolution.r1080p) {
        result.quality = Qualities.WEBDL1080p;
      } else if (resolution === Resolution.r720p) {
        result.quality = Qualities.WEBDL720p;
      } else {
        result.quality = Qualities.WEBDL480p;
      }
    } else if (getReGroup(sourceMatches, "webrip")) {
      if (resolution === Resolution.r2160p) {
        result.quality = Qualities.WEBRip2160p;
      } else if (resolution === Resolution.r1080p) {
        result.quality = Qualities.WEBRip1080p;
      } else if (resolution === Resolution.r720p) {
        result.quality = Qualities.WEBRip720p;
      } else {
        result.quality = Qualities.WEBRip480p;
      }
    } else if (getReGroup(sourceMatches, "scr")) {
      result.quality = Qualities.DVDSCR;
    } else if (getReGroup(sourceMatches, "cam")) {
      result.quality = Qualities.CAM;
    } else if (getReGroup(sourceMatches, "ts")) {
      result.quality = Qualities.TELECINE;
    } else if (getReGroup(sourceMatches, "wp")) {
      result.quality = Qualities.WORKPRINT;
    } else if (getReGroup(sourceMatches, "regional")) {
      result.quality = Qualities.REGIONAL;
    } else if (getReGroup(sourceMatches, "hdtv")) {
      if (normalizedTitle.match(MPEG2_REGEX)) {
        result.quality = Qualities.RAWHD;
      } else if (resolution === Resolution.r2160p) {
        result.quality = Qualities.HDTV2160p;
      } else if (resolution === Resolution.r1080p) {
        result.quality = Qualities.HDTV1080p;
      } else if (resolution === Resolution.r720p) {
        result.quality = Qualities.HDTV720p;
      } else {
        result.quality = Qualities.SDTV;
      }
    } else if (
      getReGroup(sourceMatches, "bdrip") ||
      getReGroup(sourceMatches, "brrip")
    ) {
      if (resolution === Resolution.r2160p) {
        result.quality = Qualities.Bluray2160p;
      } else if (resolution === Resolution.r1080p) {
        result.quality = Qualities.Bluray1080p;
      } else if (resolution === Resolution.r720p) {
        result.quality = Qualities.Bluray720p;
      } else if (resolution === Resolution.r576p) {
        result.quality = Qualities.Bluray576p;
      } else {
        result.quality = Qualities.Bluray480p;
      }
    } else if (getReGroup(sourceMatches, "dvdr")) {
      result.quality = Qualities.DVDR;
    } else if (getReGroup(sourceMatches, "dvd")) {
      result.quality = Qualities.DVD;
    } else if (
      getReGroup(sourceMatches, "pdtv") ||
      getReGroup(sourceMatches, "sdtv") ||
      getReGroup(sourceMatches, "dsr") ||
      getReGroup(sourceMatches, "tvrip")
    ) {
      if (
        resolution === Resolution.r1080p ||
        normalizedTitle.toLowerCase().match("1080p")
      ) {
        result.quality = Qualities.HDTV1080p;
      } else if (
        resolution === Resolution.r720p ||
        normalizedTitle.toLowerCase().match("720p")
      ) {
        result.quality = Qualities.HDTV720p;
      } else if (normalizedTitle.match(HIGH_DEF_PDTV_REGEX)) {
        result.quality = Qualities.Bluray720p;
      } else if (resolution === Resolution.r576p) {
        result.quality = Qualities.HDTV720p;
        result.resolutionDetectionSource = QualityDetectionSource.Title;
      } else {
        result.quality = Qualities.SDTV;
      }
    }
  } else if (
    !sourceMatches &&
    remuxMatch &&
    resolution !== Resolution.Unknown
  ) {
    result.sourceDetectionSource = QualityDetectionSource.Unknown;

    if (resolution === Resolution.r2160p) {
      result.quality = Qualities.Remux2160p;
    } else if (resolution === Resolution.r1080p) {
      result.quality = Qualities.Remux1080p;
    } else if (resolution === Resolution.r720p) {
      result.quality = Qualities.Bluray720p;
    } else {
      result.quality = Qualities.Bluray480p;
    }
    // TODO:???? Anime match
  } else if (resolution !== Resolution.Unknown) {
    let source = QualitySource.UNKNOWN;
    const modifier = Modifier.NONE;

    if (remuxMatch) {
      result.sourceDetectionSource = QualityDetectionSource.Title;
      source = QualitySource.BLURAY;
    } else {
      const quality = getQualityForExtension(normalizedTitle);

      if (quality !== Qualities.Unknown) {
        result.sourceDetectionSource = QualityDetectionSource.Extension;
        source = quality.source;
      }
    }

    if (resolution === Resolution.r2160p) {
      result.quality =
        source === QualitySource.UNKNOWN
          ? Qualities.HDTV2160p
          : getQualityForSourceAndResolution(source, 2160, modifier);
    } else if (resolution === Resolution.r1080p) {
      result.quality =
        source === QualitySource.UNKNOWN
          ? Qualities.HDTV1080p
          : getQualityForSourceAndResolution(source, 1080, modifier);
    } else if (resolution === Resolution.r720p) {
      result.quality =
        source === QualitySource.UNKNOWN
          ? Qualities.HDTV2160p
          : getQualityForSourceAndResolution(source, 720, modifier);
    } else if (
      resolution === Resolution.r360p ||
      resolution === Resolution.r480p ||
      resolution === Resolution.r540p ||
      resolution === Resolution.r576p
    ) {
      result.quality =
        source === QualitySource.UNKNOWN
          ? Qualities.HDTV2160p
          : getQualityForSourceAndResolution(source, 480, modifier);
    }
  } else if (getReGroup(codexMatches, "x264")) {
    result.quality = Qualities.SDTV;
  } else if (normalizedTitle.match(/848x480/i)) {
    result.resolutionDetectionSource = QualityDetectionSource.Title;

    if (normalizedTitle.match(/dvd/i)) {
      result.quality = Qualities.DVD;
    } else if (normalizedTitle.match(/bluray/i)) {
      result.quality = Qualities.BLURAY;
    } else {
      result.quality = Qualities.SDTV;
    }
  } else if (normalizedTitle.match(/1280x720/i)) {
    result.resolutionDetectionSource = QualityDetectionSource.Title;

    if (normalizedTitle.match(/bluray/i)) {
      result.quality = Qualities.Bluray720p;
    } else {
      result.quality = Qualities.HDTV720p;
    }
  } else if (normalizedTitle.match(/1920x1080/i)) {
    result.resolutionDetectionSource = QualityDetectionSource.Title;

    if (normalizedTitle.match(/bluray/i)) {
      result.quality = Qualities.Bluray1080p;
    } else {
      result.quality = Qualities.HDTV1080p;
    }
  } else if (normalizedTitle.match(/bluray720p/i)) {
    result.sourceDetectionSource = QualityDetectionSource.Title;
    result.resolutionDetectionSource = QualityDetectionSource.Title;
    result.quality = Qualities.Bluray720p;
  } else if (normalizedTitle.match(/bluray1080p/i)) {
    result.sourceDetectionSource = QualityDetectionSource.Title;
    result.resolutionDetectionSource = QualityDetectionSource.Title;
    result.quality = Qualities.Bluray1080p;
  } else if (normalizedTitle.match(/bluray2160p/i)) {
    result.sourceDetectionSource = QualityDetectionSource.Title;
    result.resolutionDetectionSource = QualityDetectionSource.Title;
    result.quality = Qualities.Bluray2160p;
  } else {
    const otherSourceQuality = otherSourceMatch(normalizedTitle);

    if (otherSourceQuality !== Qualities.Unknown) {
      result.sourceDetectionSource = QualityDetectionSource.Title;
      result.quality = otherSourceQuality;
    }
  }

  return result;
};

const parseQualityModifiers = (title: string): QualityModel => {
  const result: QualityModel = {
    title: title,
    quality: Qualities.Unknown,
    revision: { ...DEFAULT_REVISION },
  };

  const versionMatch = title.match(VERSION_REGEX);

  if (versionMatch) {
    result.revision.version = parseInt(versionMatch[0]);
    result.revisionDetectionSource = QualityDetectionSource.Title;
  }

  const properMatch = title.match(PROPER_REGEX);

  if (properMatch) {
    result.revision.version = versionMatch ? parseInt(versionMatch[0]) + 1 : 2;
    result.revisionDetectionSource = QualityDetectionSource.Title;
  }

  const repackMatch = title.match(REPACK_REGEX);

  if (repackMatch) {
    result.revision.version = versionMatch ? parseInt(versionMatch[0]) + 1 : 2;
    result.revision.repack = true;
    result.revisionDetectionSource = QualityDetectionSource.Title;
  }

  const realMatch = title.match(REAL_REGEX);

  if (realMatch && realMatch.length > 0) {
    result.revision.real = realMatch.length;
    result.revisionDetectionSource = QualityDetectionSource.Title;
  }

  return result;
};

const parseResolution = (title: string) => {
  const match = title.match(RESOLUTION_REGEX);
  let value = Resolution.Unknown;

  if (match) {
    if (getReGroup(match, "r360p")) {
      value = Resolution.r360p;
    } else if (getReGroup(match, "r480p")) {
      value = Resolution.r480p;
    } else if (getReGroup(match, "r540p")) {
      value = Resolution.r540p;
    } else if (getReGroup(match, "r576p")) {
      value = Resolution.r576p;
    } else if (getReGroup(match, "r720p")) {
      value = Resolution.r720p;
    } else if (getReGroup(match, "r1080p")) {
      value = Resolution.r1080p;
    } else if (getReGroup(match, "r2160p")) {
      value = Resolution.r2160p;
    }
  }

  return value;
};

const containsInvalidChars = (t: string) => {
  return t && t.match(/[/\\?%*:|"<>]/g) !== null;
};

const getQualityForExtension = (title: string) => {
  const parts = title.split(".");
  const quality = EXTENSION_QUALITIES[parts[-1]];

  return quality ? quality : Qualities.Unknown;
};

const getQualityForSourceAndResolution = (
  source: QualitySource,
  resolution: number,
  modifier: Modifier,
) => {
  // 3-way match
  let matchingQualities = Object.values(Qualities).filter((q) => {
    return (
      q.source === source &&
      q.resolution === resolution &&
      q.modifier === modifier
    );
  });

  if (matchingQualities.length === 1) {
    return matchingQualities[0];
  }

  // Source and modifier match
  matchingQualities = Object.values(Qualities).filter((q) => {
    return (
      q.source === source &&
      q.resolution === 0 &&
      q.modifier === modifier &&
      q != Qualities.Unknown
    );
  });

  if (matchingQualities.length === 1) {
    return matchingQualities[0];
  } else if (matchingQualities.length > 0) {
    for (const matchingQuality of matchingQualities) {
      if (matchingQuality.source >= source) {
        return matchingQuality;
      }
    }
  }

  // Modifier match
  const matchingModifiers = Object.values(Qualities).filter((q) => {
    return q.modifier === modifier;
  });
  const matchingResolutions = matchingModifiers
    .filter((q) => {
      return q.resolution === resolution;
    })
    .sort((a, b) => a.source - b.source);

  for (const quality of matchingResolutions) {
    if (quality.source >= source) {
      return quality;
    }
  }

  return Qualities.Unknown;
};

const getReGroup = (match: RegExpMatchArray | null, group: string) => {
  let value = undefined;

  if (
    match &&
    match.groups &&
    match.groups[group] &&
    match.groups[group].length > 0
  ) {
    value = match.groups[group][0];
  }

  return value;
};

const otherSourceMatch = (title: string) => {
  const match = title.match(OTHER_SOURCE_MATCH);
  let result = Qualities.Unknown;

  if (getReGroup(match, "sdtv")) {
    result = Qualities.SDTV;
  } else if (getReGroup(match, "hdtv")) {
    result = Qualities.HDTV;
  }

  return result;
};
