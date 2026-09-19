import { HttpService } from "@nestjs/axios";
import { IngestError } from "../error/ingestError";
import { MetadataExtractor } from "./metadataExtractor";
import { HTMLElement } from "node-html-parser";

export class DPVMetadataExtractor extends MetadataExtractor {
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

    console.log(`matches:`, matches);

    const videoId = Number.parseInt(matches[1]);
    const videoBlock = Math.trunc(videoId / 1000) * 1000;
    const videoUrl = `https://dp-vids.com/contents/videos/${videoBlock}/${videoId}/${videoId}.mp4`;

    console.log(`videoId: ${videoId}`);
    console.log(`videoBlock: ${videoBlock}`);
    console.log(`videoUrl: ${videoUrl}`);

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
