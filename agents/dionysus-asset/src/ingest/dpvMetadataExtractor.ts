import { HttpService } from "@nestjs/axios";
import { IngestError } from "../error/ingestError";
import { MetadataExtractor } from "./metadataExtractor";
import { HTMLElement } from "node-html-parser";

export class DPVMetadataExtractor extends MetadataExtractor {
  constructor(client: HttpService, url: string, id: string) {
    super(client, url, id);
  }

  async getSegmentUrls(root: HTMLElement): Promise<string[]> {
    const headElement = root.querySelector("head");
    const scripts = headElement?.querySelectorAll("script");
    const segments: string[] = [];
    let videoUrl = undefined;

    for (const script of scripts || []) {
      if (script.textContent) {
        const scriptLines = script.textContent.split("\n");

        for (const scriptLine of scriptLines) {
          if (scriptLine.includes("contentUrl")) {
            const contentUrl = scriptLine.trim();

            videoUrl = contentUrl.substring(
              contentUrl.indexOf("http"),
              contentUrl.length - 2,
            );

            segments.push(videoUrl);
          }
        }
      }
    }

    if (!videoUrl) {
      throw new IngestError("Could not locate video URL");
    }

    return segments;
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
