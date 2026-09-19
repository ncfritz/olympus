import type { FileMeta, NZB } from "./models";

type FileSummary = {
  name: string;
  timestamp: Date;
  size: number;
  subject: string;
  groups: string[];
  poster: string;
};

/** nzbMeta.json: what the workflow keeps of a download's NZB. */
export type NzbMetadata = {
  parSize: number;
  size: number;
  groups: string[];
  names: string[];
  posters: string[];
  meta: {
    title?: string;
    tag?: string;
    tags: string[];
    category?: string;
    password?: string;
    passwords: string[];
  };
  /** The largest file (the media). */
  file: FileSummary;
  files: FileSummary[];
};

const fileSummary = (file: FileMeta): FileSummary => ({
  name: file.name,
  timestamp: file.datetime,
  size: file.size,
  subject: file.subject,
  groups: file.groups,
  poster: file.poster,
});

/** The metadata of a parsed NZB, for nzbMeta.json. */
export const nzbMetadata = (nzb: NZB): NzbMetadata => ({
  parSize: nzb.par2Size,
  size: nzb.size,
  groups: nzb.groups,
  names: nzb.names,
  posters: nzb.posters,
  meta: {
    title: nzb.meta.title,
    tag: nzb.meta.tag,
    tags: nzb.meta.tags,
    category: nzb.meta.category,
    password: nzb.meta.password,
    passwords: nzb.meta.passwords,
  },
  file: fileSummary(nzb.file),
  files: nzb.files.map(fileSummary),
});
