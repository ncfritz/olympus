import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ConsumeMessage } from "amqplib";
import axios from "axios";
import fs from "fs";
import { finished } from "node:stream/promises";
import mediaApi from "../../api/mediaApi";
import parse from "../../nzb/parser";
import { type StartDownloadMessage } from "../../types/message";
import {
  DOWNLOAD_PREFIX,
  DOWNLOAD_TRIGGER_EXCHANGE,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";

@Injectable()
export class StartDownloadHandler {
  constructor(protected readonly configService: ConfigService) {}

  @RabbitSubscribe({
    exchange: DOWNLOAD_TRIGGER_EXCHANGE,
    queue: `${DOWNLOAD_PREFIX}.${TRIGGER_SUFFIX}`,
    routingKey: `${DOWNLOAD_PREFIX}.start`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: StartDownloadMessage, amqMsg: ConsumeMessage) {
    const nzbGeekApiKey = this.configService.get("NZBGEEK_API_KEY");
    const nzbGeekUrl = `https://api.nzbgeek.info/api?t=get&id=${msg.nzbId}&apikey=${nzbGeekApiKey}`;

    const stagingDir = process.env.STAGING_DIRECTORY!;
    const nzbFilename = `/tmp/${msg.nzbId}.nzb`;

    const writer = fs.createWriteStream(nzbFilename);
    const response = await axios.get(nzbGeekUrl, {
      responseType: "stream",
    });
    response.data.pipe(writer);
    await finished(writer);

    const rawNzb = fs.readFileSync(nzbFilename, "utf8");
    const nzb = parse(rawNzb);
    const metadata: any = {};

    metadata.parSize = nzb.par2Size;
    metadata.size = nzb.size;
    metadata.groups = nzb.groups;
    metadata.names = nzb.names;
    metadata.posters = nzb.posters;

    metadata.meta = {};
    metadata.meta.title = nzb.meta.title;
    metadata.meta.tag = nzb.meta.tag;
    metadata.meta.tags = nzb.meta.tags;
    metadata.meta.category = nzb.meta.category;
    metadata.meta.password = nzb.meta.password;
    metadata.meta.passwords = nzb.meta.passwords;

    metadata.file = {};
    metadata.file.name = nzb.file.name;
    metadata.file.groups = nzb.file.groups;
    metadata.file.size = nzb.file.size;
    metadata.file.poster = nzb.file.poster;
    metadata.file.timestamp = nzb.file.datetime;
    metadata.file.subject = nzb.file.subject;

    metadata.files = nzb.files.map((file) => {
      return {
        name: file.name,
        timestamp: file.datetime,
        size: file.size,
        subject: file.subject,
        groups: file.groups,
        poster: file.poster,
      };
    });

    const nzbGetUsername = this.configService.get("NZBGET_USERNAME");
    const nzbGetPassword = this.configService.get("NZBGET_PASSWORD");

    const nzbGetUrl = `http://localhost:6789/jsonrpc`;

    const rpcResponse = await axios.post(
      nzbGetUrl,
      {
        id: 1,
        jsonrpc: "2.0",
        method: "append",
        params: [
          nzb.file.name,
          Buffer.from(rawNzb).toString("base64"),
          "dionysus",
          0,
          false,
          false,
          "",
          0,
          "SCORE",
          [],
        ],
      },
      {
        auth: { username: nzbGetUsername, password: nzbGetPassword },
      },
    );

    if (rpcResponse.data.result >= 0) {
      await mediaApi.updateMediaAssetDownload(
        msg.mediaType,
        msg.mediaId,
        msg.resultId,
        msg.downloadId,
        {
          nzbId: rpcResponse.data.result,
        },
      );

      if (!fs.existsSync(`${stagingDir}/${msg.workflowId}`)) {
        fs.mkdirSync(`${stagingDir}/${msg.workflowId}`, { recursive: true });
      }

      fs.writeFileSync(
        `${stagingDir}/${msg.workflowId}/nzbMeta.json`,
        JSON.stringify(metadata),
      );
    } else {
      logger.error(`Failed to add NZB to NZBGet: ${rpcResponse.data.error}`);
    }
  }
}
