import { HttpService } from "@nestjs/axios";
import { Parser } from "m3u8-parser";
import { firstValueFrom } from "rxjs";
import { USER_AGENT } from "../util/constants";
import { IngestError } from "../error/ingestError";
import { MetadataExtractor } from "./metadataExtractor";
import { HTMLElement } from "node-html-parser";

export class XHMetadataExtractor extends MetadataExtractor {
  constructor(client: HttpService, url: string, id: string) {
    super(client, url, id);
  }

  async getSegmentUrls(root: HTMLElement): Promise<string[]> {
    const headElement = root.querySelector("head");
    const linkElements = headElement?.querySelectorAll("link");
    let masterPlaylistUrl = undefined;

    for (const link of linkElements || []) {
      if (link.hasAttribute("href")) {
        const href = link.getAttribute("href");

        if (href?.endsWith(".m3u8")) {
          masterPlaylistUrl = href;

          break;
        }
      }
    }

    if (!masterPlaylistUrl) {
      throw new IngestError("Could not locate master m3u8 playlist URL");
    }

    const mediaBaseUri = masterPlaylistUrl.substring(
      0,
      masterPlaylistUrl.lastIndexOf("/"),
    );
    const masterPlaylistResponse = await firstValueFrom(
      this.client.get(masterPlaylistUrl, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }),
    );
    const masterPlaylistParser = new Parser();
    masterPlaylistParser.push(masterPlaylistResponse.data);
    masterPlaylistParser.end();

    let currentResolution = 0;
    let mediaPlaylistUri = undefined;

    for (const playlist of masterPlaylistParser.manifest.playlists) {
      const resolution = playlist.attributes.RESOLUTION.height;

      if (resolution > 720) {
        continue;
      }

      if (resolution > currentResolution) {
        currentResolution = resolution;
        mediaPlaylistUri = playlist.uri;
      }
    }

    const mediaPlaylistUrl = `${mediaBaseUri}/${mediaPlaylistUri}`;
    const mediaPlaylistResponse = await firstValueFrom(
      this.client.get(mediaPlaylistUrl, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }),
    );
    const mediaPlaylistParser = new Parser();
    mediaPlaylistParser.push(mediaPlaylistResponse.data);
    mediaPlaylistParser.end();

    const segments: string[] = [];
    let initAdded = false;

    for (const segment of mediaPlaylistParser.manifest.segments) {
      if (!initAdded) {
        segments.push(`${mediaBaseUri}/${segment.map.uri}`);

        initAdded = true;
      }

      segments.push(`${mediaBaseUri}/${segment.uri}`);
    }

    return segments;
  }

  async getTitle(root: HTMLElement): Promise<string> {
    let title = this.id;

    const metaElement = root.querySelector("meta[property='og:title']");

    if (metaElement) {
      const metaElementValue = metaElement.getAttribute("content");

      if (metaElementValue) {
        title = metaElementValue;
      }
    }

    return title;
  }
}
