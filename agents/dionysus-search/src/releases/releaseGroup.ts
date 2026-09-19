/**
 * The release group of a release title, after Radarr's
 * Parser.ParseReleaseGroup (the TRaSH group formats assume its results).
 */

const FILE_EXTENSION = /\.(?:mkv|mp4|avi|m4v|ts|wmv|nzb|par2|rar)$/i;

const WEBSITE_PREFIX =
  /^(?:\[\s*)?(?:www\.)?[-a-z0-9-]{1,256}\.(?:[a-z]{2,6}\.[a-z]{2,6}|xn--[a-z0-9-]{4,}|[a-z]{2,})\b(?:\s*\]|[ -]{2,})[ -]*/i;

const TORRENT_SUFFIX = /\[(?:ettv|rartv|rarbg|cttv|publichd)\]$/i;

/** `[Group] Title - 01`: fansub groups lead the title. */
const ANIME_GROUP = /^(?:\[(?<group>(?!\s).+?(?<!\s))\](?:_|-|\s|\.)?)/i;

/** Episode prefixes and indexer/reposter suffixes that aren't the group. */
const NOT_THE_GROUP =
  /^(.*?[-._ ](S\d+E\d+)[-._ ])|(-(RP|1|NZBGeek|Obfuscated|Scrambled|sample|Pre|postbot|xpost|Rakuten|AsRequested|AlternativeToRequested|GEROV|Z0iDS3N|Chamele0n|4P|4Planet|AlteZachen|RePACKPOST))+$/gi;

/** Groups that tag releases as `[Group]` or `(Group)` mid-title. */
const BRACKETED_GROUPS =
  /(?<=[._ [])(?<group>(Silence|afm72|Panda|Ghost|MONOLITH|Tigole|Joy|ImE|UTR|t3nzin|Anime Time|Project Angel|Hakata Ghost|HONE|Vyndros|SEV|Garshasp|Kappa|Natty|RCVR|SAMPA|YOGI|r00t|EDGE2020|RZeroX)(?=\]|\)))/gi;

/** Groups whose names the general rule would cut short. */
const EXACT_GROUPS =
  /\b(?<group>KRaLiMaRKo|E\.N\.D|D-Z0N3|Koten_Gars|BluDragon|ZØNEHD|HQMUX|VARYG|YIFY|YTS(\.(MX|LT|AG))?|TMd|Eml HDTeam|LMain|DarQ|BEN THE MEN|TAoE|QxR|126811)\b/gi;

/** `-Group` at the end (not a codec, resolution or language), or `[Group]`. */
const TRAILING_GROUP =
  /-(?<group>[a-z0-9]+(?<part2>-[a-z0-9]+)?(?!.+?(?:480p|576p|720p|1080p|2160p)))(?<!(?:WEB-DL|Blu-Ray|480p|576p|720p|1080p|2160p|DTS-HD|DTS-X|DTS-MA|DTS-ES|-ES|-EN|-CAT|-ENG|-GER|-FRA|-FRE|-ITA|\d{1,2}-bit|[ ._]\d{4}-\d{2}|-\d{2})(?:\k<part2>)?)(?:\b|[-._ ]|$)|[-._ ]\[(?<bracketed>[a-z0-9]+)\]$/gi;

/** Episode numbers and hashes, not groups. */
const INVALID_GROUP = /^([se]\d+|[0-9a-f]{8})$/i;

const lastGroup = (title: string, pattern: RegExp): string | undefined => {
  const matches = [...title.matchAll(pattern)];
  const last = matches[matches.length - 1];
  return last?.groups?.group ?? last?.groups?.bracketed;
};

export const parseReleaseGroup = (title: string): string | undefined => {
  let cleaned = title
    .trim()
    .replace(FILE_EXTENSION, "")
    .replace(WEBSITE_PREFIX, "")
    .replace(TORRENT_SUFFIX, "");

  const anime = cleaned.match(ANIME_GROUP)?.groups?.group;
  if (anime) return anime;

  cleaned = cleaned.replace(NOT_THE_GROUP, "");

  const known =
    lastGroup(cleaned, BRACKETED_GROUPS) ?? lastGroup(cleaned, EXACT_GROUPS);
  if (known) return known;

  const group = lastGroup(cleaned, TRAILING_GROUP);
  if (!group || /^\d+$/.test(group) || INVALID_GROUP.test(group)) {
    return undefined;
  }
  return group;
};
