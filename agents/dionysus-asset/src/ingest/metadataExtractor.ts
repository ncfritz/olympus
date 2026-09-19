import { HttpService } from "@nestjs/axios";
import { HTMLElement } from "node-html-parser";

export abstract class MetadataExtractor {
  public client: HttpService;
  public readonly url: string;
  public readonly id: string;

  protected constructor(client: HttpService, url: string, id: string) {
    this.client = client;
    this.url = url;
    this.id = id;
  }

  isLocal(): boolean {
    return false;
  }

  abstract getTitle(root: HTMLElement | string): Promise<string>;
  abstract getSegmentUrls(root: HTMLElement): Promise<string[]>;
}
