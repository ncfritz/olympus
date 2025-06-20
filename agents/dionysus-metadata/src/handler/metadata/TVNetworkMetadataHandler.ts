import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  MetadataFetchJob,
  PartialNetwork,
  PartialNetworkAlternativeName,
  PartialNetworkImage,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import metadataApi from "../../api/metadataApi";
import { NetworksEndpoint } from "../../api/tmdb/network";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { MetadataJobMessage } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class TVNetworkMetadataHandler extends BaseMetadataHandler<
  PartialNetwork,
  undefined
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.${JobType.TV_NETWORKS}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.TV_NETWORKS}`,
    queueOptions: {
      channel: "metadataChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: MetadataJobMessage, amqpMsg: ConsumeMessage) {
    await this.doFetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadataFetchJob: MetadataFetchJob,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadataManager: MetadataFetchJobManager,
  ): Promise<[PartialNetwork, undefined]> {
    const endpoint = new NetworksEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const networkId = parseInt(entityId);
    const networkResponse = await endpoint.details(networkId);
    const alternativeNamesResponse = await endpoint.alternativeNames(networkId);
    const imagesResponse = await endpoint.images(networkId);

    const network = new PartialNetwork();
    network.id = networkResponse.id;
    network.name = networkResponse.name;
    network.headquarters = networkResponse.headquarters;
    network.homepage = networkResponse.homepage;
    network.logoPath = networkResponse.logo_path;
    network.originCountry = networkResponse.origin_country;

    const alternativeNames: PartialNetworkAlternativeName[] = [];

    alternativeNamesResponse.results.forEach((value) => {
      alternativeNames.push({
        networkId: networkResponse.id,
        name: value.name,
        type: value.type,
      });
    });

    const logos: PartialNetworkImage[] = [];

    imagesResponse.logos.forEach((value) => {
      logos.push({
        networkId: networkResponse.id,
        id: value.id,
        fileType: value.file_type,
        filePath: value.file_path,
        width: value.width,
        height: value.height,
      });
    });

    network.alternativeNames = alternativeNames;
    network.logos = logos;

    await metadataApi.createNetwork(network);

    return [network, undefined];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getTtl(metadata: PartialNetwork): number {
    return Math.max(7, Math.floor(Math.random() * 180));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getJitter(metadata: PartialNetwork): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }

  protected cleanup(): Promise<void> {
    return Promise.resolve();
  }
}
