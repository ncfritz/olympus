import { Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";

import { IngestError } from "../../tools/errors/IngestError";
import { MetadataExtractor } from "./MetadataExtractor";
import { HTMLElement } from "node-html-parser";

const logger = new Logger("DpvMetadataExtractor");

export class DpvMetadataExtractor extends MetadataExtractor {
  constructor(client: HttpService, url: string, id: string) {
    super(client, url, id);
  }

  async getSegmentUrls(_root: HTMLElement): Promise<string[]> {
    const matches = this.url.match(
      /^http[s]?:\/\/dp-vids\.com\/videos\/(\d+)\/.*$/i,
    );

    if (!matches || matches.length <= 0) {
      throw new IngestError("Unable to determine video ID from url");
    }

    logger.log(
      `matches: ${matches instanceof Error ? matches.message : JSON.stringify(matches)}`,
    );

    const videoId = Number.parseInt(matches[1]);
    const videoBlock = Math.trunc(videoId / 1000) * 1000;
    const videoUrl = `https://dp-vids.com/contents/videos/${videoBlock}/${videoId}/${videoId}.mp4`;

    logger.log(`videoId: ${videoId}`);
    logger.log(`videoBlock: ${videoBlock}`);
    logger.log(`videoUrl: ${videoUrl}`);

    return [videoUrl];
  }

  async getTitle(root: HTMLElement): Promise<string> {
    let title = this.id;

    const headlineElement = root.querySelector("div.headline");

    if (headlineElement) {
      const h1Element = headlineElement.querySelector("h1");

      if (h1Element) {
        title = h1Element.textContent;
      }
    }

    return title;
  }
}
