import { v4 as uuidv4 } from "uuid";
import { HTMLElement } from "node-html-parser";

export abstract class MetadataExtractor {
  public readonly url: string;
  public readonly id: string;

  protected constructor(url: string) {
    this.url = url;
    this.id = uuidv4();
  }

  isLocal(): boolean {
    return false;
  }

  abstract getTitle(root: HTMLElement | string): Promise<string>;
  abstract getSegmentUrls(root: HTMLElement): Promise<string[]>;
};