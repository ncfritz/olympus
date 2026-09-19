import { HttpService } from "@nestjs/axios";
import path from "path";
import { MetadataExtractor } from "./metadataExtractor";
import { HTMLElement } from "node-html-parser";

export class LocalMetadataExtractor extends MetadataExtractor {
  readonly originalFile: string;

  constructor(client: HttpService, file: string, id: string) {
    super(client, `file://${file}`, id);
    this.originalFile = file;
  }

  isLocal(): boolean {
    return true;
  }

  getSegmentUrls(_root: HTMLElement): Promise<string[]> {
    return Promise.resolve([]);
  }

  getTitle(_root: HTMLElement): Promise<string> {
    let name = path.basename(this.originalFile.toString());

    if (name.indexOf(".") > 0) {
      name = name.substring(0, name.lastIndexOf("."));
    }

    return Promise.resolve(name);
  }
}
