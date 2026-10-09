/**
 * Shape of the NZB summary the download step writes to the CDN for a media
 * asset workflow. Written by the pipeline from the NZB it fetched, so only the
 * fields the UI reads are declared.
 */

export interface NzbFile {
  name?: string;
  subject?: string;
  poster?: string;
  size: number;
  /** ISO-8601, as the pipeline writes it. */
  timestamp?: string;
}

export interface NzbMeta {
  title?: string;
  category?: string;
  passwords?: string;
}

export interface NzbMetadata {
  meta: NzbMeta;
  /** The NZB's own top-level file entry, distinct from `files`. */
  file: NzbFile;
  files?: NzbFile[];
  size: number;
  parSize: number;
  groups?: string;
  posters?: string;
}
