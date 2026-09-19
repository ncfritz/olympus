import { XMLParser, XMLValidator } from "fast-xml-parser";
import { InvalidNZBError } from "./exceptions";
import { NZB, FileMeta, Meta, Segment } from "./models";

const parser = new XMLParser({ ignoreAttributes: false });

export default function parse(string: string): NZB {
  try {
    const valid = XMLValidator.validate(string);

    if (valid !== true) throw new SyntaxError("Invalid XML");

    const nzbdict = parser.parse(string) as NzbXml;

    const meta = parseMetadata(nzbdict);

    const files = parseFiles(nzbdict);

    return new NZB({ meta, files });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new InvalidNZBError(error.message);
    } else {
      throw error;
    }
  }
}

type MetaFieldType =
  Array<Record<string, string>> | Record<string, string> | undefined;

/** A `<segment>`: attributes are strings (parseAttributeValue is off). */
type XmlSegment = {
  "@_bytes"?: string;
  "@_number"?: string;
  "#text"?: string;
};

type XmlSegments = { segment?: XmlSegment | XmlSegment[] };

type XmlFile = {
  "@_poster": string;
  "@_date": string | number;
  "@_subject": string;
  groups?: { group?: GroupFieldType };
  segments?: XmlSegments | null;
};

type FileFieldType = Array<XmlFile> | XmlFile | undefined;

type GroupFieldType = Array<string> | string | undefined;

/** An NZB as fast-xml-parser reads it. */
type NzbXml = {
  nzb?: { head?: { meta?: MetaFieldType }; file?: FileFieldType | null };
};

function parseMetadata(nzb: NzbXml): Meta {
  let meta: MetaFieldType = nzb?.nzb?.head?.meta;

  if (!meta) return new Meta();

  if (!Array.isArray(meta)) meta = [meta];

  const passwords = new Set<string>();

  const tags = new Set<string>();

  let title: string | undefined;

  let category: string | undefined;

  for (const item of meta) {
    const type = item["@_type"]?.toLowerCase();

    const text = item["#text"];

    if (type === "title") {
      title = text;
    } else if (type === "password") {
      if (text) passwords.add(text);
    } else if (type === "tag") {
      if (text) tags.add(text.trim());
    } else if (type === "category") {
      category = text;
    }
  }

  return new Meta({
    title,

    passwords: [...passwords],

    tags: [...tags],

    category,
  });
}

function parseSegments(segmentdict: XmlSegments | null | undefined): Segment[] {
  const segments = segmentdict?.segment;

  if (!segments) {
    throw new SyntaxError("Missing or malformed <segments>...</segments>!");
  }

  const segmentList = Array.isArray(segments) ? segments : [segments];

  const segmentset: Segment[] = [];

  for (const segment of segmentList) {
    const size = segment["@_bytes"];

    const number = segment["@_number"];

    const messageId = segment["#text"];

    if (size && number && messageId) {
      segmentset.push(new Segment(parseInt(size), parseInt(number), messageId));
    }
  }

  return segmentset.sort((a, b) => a.number - b.number);
}

function parseFiles(nzb: NzbXml): FileMeta[] {
  const fileTags = nzb?.nzb?.file;

  if (fileTags === null || fileTags === undefined) {
    throw new SyntaxError("Missing or malformed <file>...</file>!");
  }

  const files: FileMeta[] = [];

  for (const file of Array.isArray(fileTags) ? fileTags : [fileTags]) {
    const groupSet = new Set<string>();

    const groups = file.groups?.group;

    if (groups === null || groups === undefined) {
      throw new SyntaxError("Missing or malformed <groups>...</groups>!");
    }

    if (typeof groups === "string") {
      groupSet.add(groups);
    } else {
      groups.forEach((group) => groupSet.add(group));
    }

    files.push(
      new FileMeta({
        poster: file["@_poster"],

        datetime: new Date(Number(file["@_date"]) * 1000),

        subject: file["@_subject"],

        groups: [...groupSet].sort(),

        segments: parseSegments(file.segments),
      }),
    );
  }

  return files.sort((a, b) => a.subject.localeCompare(b.subject));
}
