import path from "path";
import { MetadataExtractor } from "./metadataExtractor";
import { HTMLElement } from "node-html-parser";

export class LocalMetadataExtractor extends MetadataExtractor {
  readonly originalFile: string;

  constructor(file: string) {
    super(`file://${file}`);
    this.originalFile = file;
  }

  isLocal(): boolean {
    return true;
  }

  getSegmentUrls(root: HTMLElement): Promise<string[]> {
    return Promise.resolve([]);
  }

  getTitle(root: HTMLElement): Promise<string> {
    let name = path.basename(this.originalFile.toString());

    if (name.indexOf(".") > 0) {
      name = name.substring(0, name.lastIndexOf("."));
    }

    return Promise.resolve(name);
  }
}