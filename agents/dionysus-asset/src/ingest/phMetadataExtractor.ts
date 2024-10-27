import axios from "axios";
import { Parser } from "m3u8-parser";
import { USER_AGENT } from "../util/constants";
import { IngestError } from "./ingestError";
import { MetadataExtractor } from "./metadataExtractor";
import { HTMLElement } from "node-html-parser";

export class PHMetadataExtractor extends MetadataExtractor {
  constructor(url: string) {
    super(url);
  }

  async getSegmentUrls(root: HTMLElement): Promise<string[]> {
    const playerRoot = root.querySelector("#player");
    const playerConfig = playerRoot?.querySelector("script");
    const configLines = playerConfig?.textContent.split("\n");
    let targetConfig = undefined;

    if (!configLines) {
      throw new IngestError("Unable to find player config script element");
    }

    for (const config of configLines) {
      if (config.includes("flashvars") && config.includes("m3u8")) {
        const rawConfig = config.substring(config.indexOf("{") - 1);
        targetConfig = JSON.parse(rawConfig.substring(0, rawConfig.length - 1));

        break;
      }
    }

    if (!targetConfig) {
      throw new IngestError(
        "Unable to find flashvars config line, no m3u8 playlist detected"
      );
    }

    let masterPlaylistUrl = undefined;
    let currentResolution = 0;

    for (const mediaDefinition of targetConfig.mediaDefinitions) {
      const resolution = parseInt(mediaDefinition.quality);

      if (resolution > 720) {
        continue;
      }

      if (resolution > currentResolution) {
        currentResolution = resolution;
        masterPlaylistUrl = mediaDefinition.videoUrl;
      }
    }

    if (!masterPlaylistUrl) {
      throw new IngestError("Could not locate master m3u8 playlist URL");
    }

    const mediaBaseUri = masterPlaylistUrl.substring(
      0,
      masterPlaylistUrl.lastIndexOf("/")
    );
    const masterPlaylistResponse = await axios.get(masterPlaylistUrl, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });
    const masterPlaylistParser = new Parser();
    masterPlaylistParser.push(masterPlaylistResponse.data);
    masterPlaylistParser.end();

    const mediaPlaylistUrl = `${mediaBaseUri}/${masterPlaylistParser.manifest.playlists[0].uri}`;
    const [mediaPlaylistResponse] = await Promise.all([
      axios.get(mediaPlaylistUrl, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }),
    ]);
    const mediaPlaylistParser = new Parser();
    mediaPlaylistParser.push(mediaPlaylistResponse.data);
    mediaPlaylistParser.end();

    const segments: string[] = [];

    for (const segment of mediaPlaylistParser.manifest.segments) {
      segments.push(`${mediaBaseUri}/${segment.uri}`);
    }

    return segments;
  }

  async getTitle(root: HTMLElement): Promise<string> {
    let title = this.id;

    const titleElement = root.querySelector("span.inlineFree");

    if (titleElement && titleElement.textContent) {
      title = titleElement.textContent;
    }

    return title;
  }
}
