import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  PartialAlternativeName,
  PartialIdentifiableImage,
  PartialNetwork,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import metadataApi from "../../api/metadataApi";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { type MetadataJobMessage } from "../../types/message";
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
    queue: `${METADATA_JOB_PREFIX}.tv_networks.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.tv_networks`,
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
    const networkId = parseInt(entityId);
    const networkResponse = await this.tmdbApi.getNetworkDetails(networkId);
    const alternativeNamesResponse =
      await this.tmdbApi.getNetworkAlternativeNames(networkId);
    const imagesResponse = await this.tmdbApi.getNetworkImages(networkId);

    const alternativeNames: PartialAlternativeName[] = [];

    alternativeNamesResponse.results.forEach((value) => {
      alternativeNames.push({
        name: value.name,
        type: value.type,
      });
    });

    const images: PartialIdentifiableImage[] = [];

    imagesResponse.logos.forEach((value) => {
      images.push({
        id: value.id,
        fileType: value.file_type,
        filePath: value.file_path,
        width: value.width,
        height: value.height,
      });
    });

    const network: PartialNetwork = {
      id: networkResponse.id,
      name: networkResponse.name,
      headquarters: networkResponse.headquarters,
      homepage: networkResponse.homepage,
      logoPath: networkResponse.logo_path,
      originCountry: networkResponse.origin_country,
      alternativeNames: alternativeNames,
      images: images,
    };

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
