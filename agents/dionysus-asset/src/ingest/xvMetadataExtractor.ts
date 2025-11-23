import { HttpService } from "@nestjs/axios";
import { Parser } from "m3u8-parser";
import { firstValueFrom } from "rxjs";
import { USER_AGENT } from "../util/constants";
import { IngestError } from "../error/ingestError";
import { MetadataExtractor } from "./metadataExtractor";
import { HTMLElement } from "node-html-parser";

export class XVMetadataExtractor extends MetadataExtractor {
  constructor(client: HttpService, url: string, id: string) {
    super(client, url, id);
  }

  async getSegmentUrls(root: HTMLElement): Promise<string[]> {
    const playerBGElement = root.querySelector("#video-player-bg");
    const scripts = playerBGElement?.querySelectorAll("script");
    let masterPlaylistUrl = undefined;

    for (const script of scripts || []) {
      if (script.textContent) {
        const scriptLines = script.textContent.split("\n");

        for (const scriptLine of scriptLines) {
          if (scriptLine.includes("m3u8")) {
            masterPlaylistUrl = scriptLine.substring(
              scriptLine.indexOf("(") + 2,
              scriptLine.length - 3,
            );
          }
        }
      }
    }

    if (!masterPlaylistUrl) {
      const headElement = root.querySelector("head");
      const scripts = headElement?.querySelectorAll("script");

      for (const script of scripts || []) {
        const scriptLines = script.textContent.split("\n");

        for (const scriptLine of scriptLines) {
          if (scriptLine.includes("contentUrl")) {
            const contentUrl = scriptLine.substring(
              scriptLine.indexOf(":") + 3,
              scriptLine.length - 2,
            );

            return [contentUrl];
          }
        }
      }

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

    for (const segment of mediaPlaylistParser.manifest.segments) {
      segments.push(`${mediaBaseUri}/${segment.uri}`);
    }

    return segments;
  }

  async getTitle(root: HTMLElement): Promise<string> {
    let title = this.id;

    const playerBGElement = root.querySelector("#video-player-bg");
    const scripts = playerBGElement?.querySelectorAll("script");

    for (const script of scripts || []) {
      if (script.textContent) {
        const scriptLines = script.textContent.split("\n");

        for (const scriptLine of scriptLines) {
          if (scriptLine.includes("setVideoTitle")) {
            const line = scriptLine.trim();
            title = line.substring(
              line.indexOf("setVideoTitle") + "setVideoTitle".length + 2,
              line.length - 3,
            );

            break;
          }
        }
      }
    }

    return title;
  }
}
